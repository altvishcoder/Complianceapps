import * as client from 'openid-client';
import { db } from '../db';
import { users, organisations } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../logger';

interface KeycloakConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  logoutRedirectUri?: string;
}

interface KeycloakTokenClaims {
  sub: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  realm_access?: {
    roles: string[];
  };
  resource_access?: Record<string, { roles: string[] }>;
  organisationId?: string;
  org_id?: string;
}

const ROLE_MAPPING: Record<string, string> = {
  'SUPER_ADMIN': 'SUPER_ADMIN',
  'LASHAN_SUPER_USER': 'LASHAN_SUPER_USER',
  'SYSTEM_ADMIN': 'SYSTEM_ADMIN',
  'COMPLIANCE_MANAGER': 'COMPLIANCE_MANAGER',
  'ADMIN': 'ADMIN',
  'MANAGER': 'MANAGER',
  'OFFICER': 'OFFICER',
  'VIEWER': 'VIEWER',
};

function normalizeRole(keycloakRoles: string[]): string {
  const roleHierarchy = [
    'LASHAN_SUPER_USER',
    'SUPER_ADMIN',
    'SYSTEM_ADMIN',
    'COMPLIANCE_MANAGER',
    'ADMIN',
    'MANAGER',
    'OFFICER',
    'VIEWER',
  ];
  
  for (const role of roleHierarchy) {
    if (keycloakRoles.some(r => r.toUpperCase() === role)) {
      return ROLE_MAPPING[role] || role;
    }
  }
  
  return 'VIEWER';
}

export class KeycloakService {
  private appConfig: KeycloakConfig | null = null;
  private oidcConfig: client.Configuration | null = null;
  private initialized = false;

  isConfigured(): boolean {
    return !!(
      process.env.KEYCLOAK_BASE_URL &&
      process.env.KEYCLOAK_REALM &&
      process.env.KEYCLOAK_CLIENT_ID
    );
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (!this.isConfigured()) {
      logger.info('Keycloak not configured - SSO disabled');
      return false;
    }

    try {
      this.appConfig = {
        baseUrl: process.env.KEYCLOAK_BASE_URL!,
        realm: process.env.KEYCLOAK_REALM!,
        clientId: process.env.KEYCLOAK_CLIENT_ID!,
        clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
        redirectUri: process.env.KEYCLOAK_REDIRECT_URI || '/api/auth/keycloak/callback',
        logoutRedirectUri: process.env.KEYCLOAK_LOGOUT_REDIRECT_URI || '/',
      };

      const issuerUrl = new URL(`${this.appConfig.baseUrl}/realms/${this.appConfig.realm}`);
      
      this.oidcConfig = await client.discovery(
        issuerUrl,
        this.appConfig.clientId,
        this.appConfig.clientSecret
      );

      this.initialized = true;
      logger.info({ realm: this.appConfig.realm }, 'Keycloak OIDC initialized successfully');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Keycloak');
      return false;
    }
  }

  buildAuthorizationUrl(state: string, nonce: string, codeChallenge: string): string {
    if (!this.initialized || !this.oidcConfig || !this.appConfig) {
      throw new Error('Keycloak not initialized');
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const redirectUri = new URL(this.appConfig.redirectUri, appUrl).toString();

    const authUrl = client.buildAuthorizationUrl(this.oidcConfig, {
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });

    return authUrl.href;
  }

  async handleCallback(
    code: string,
    state: string,
    expectedState: string,
    expectedNonce: string,
    codeVerifier: string
  ): Promise<{ user: any; isNewUser: boolean } | null> {
    if (!this.initialized || !this.oidcConfig || !this.appConfig) {
      throw new Error('Keycloak not initialized');
    }

    if (state !== expectedState) {
      throw new Error('State mismatch - possible CSRF attack');
    }

    try {
      const appUrl = process.env.APP_URL || 'http://localhost:5000';
      const redirectUri = new URL(this.appConfig.redirectUri, appUrl);
      redirectUri.searchParams.set('code', code);
      redirectUri.searchParams.set('state', state);

      const tokens = await client.authorizationCodeGrant(
        this.oidcConfig,
        redirectUri,
        {
          pkceCodeVerifier: codeVerifier,
          expectedState,
          expectedNonce,
        }
      );

      const claims = tokens.claims() as unknown as KeycloakTokenClaims;
      
      const keycloakRoles = claims.realm_access?.roles || [];
      const role = normalizeRole(keycloakRoles);
      
      const orgId = claims.organisationId || claims.org_id || null;
      
      let [existingUser] = await db.select().from(users).where(eq(users.email, claims.email || ''));
      
      let isNewUser = false;
      
      if (!existingUser && claims.preferred_username) {
        [existingUser] = await db.select().from(users).where(eq(users.username, claims.preferred_username));
      }

      if (!existingUser) {
        let organisationId = orgId;
        
        if (!organisationId) {
          const [defaultOrg] = await db.select().from(organisations).limit(1);
          organisationId = defaultOrg?.id || null;
        }

        if (!organisationId) {
          throw new Error('No organisation found for new user');
        }

        const [newUser] = await db.insert(users).values({
          username: claims.preferred_username || claims.email || claims.sub,
          email: claims.email || `${claims.sub}@keycloak.local`,
          name: claims.name || `${claims.given_name || ''} ${claims.family_name || ''}`.trim() || 'SSO User',
          password: '',
          role: role as any,
          organisationId,
          keycloakId: claims.sub,
        }).returning();

        existingUser = newUser;
        isNewUser = true;
        
        logger.info({ userId: newUser.id, username: newUser.username }, 'Created new user from Keycloak SSO');
      } else if (!existingUser.keycloakId) {
        await db.update(users)
          .set({ keycloakId: claims.sub })
          .where(eq(users.id, existingUser.id));
        
        existingUser = { ...existingUser, keycloakId: claims.sub };
      }

      return {
        user: {
          id: existingUser.id,
          username: existingUser.username,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          organisationId: existingUser.organisationId,
        },
        isNewUser,
      };
    } catch (error) {
      logger.error({ error }, 'Keycloak callback failed');
      throw error;
    }
  }

  getLogoutUrl(idTokenHint?: string): string {
    if (!this.initialized || !this.oidcConfig || !this.appConfig) {
      throw new Error('Keycloak not initialized');
    }

    const endSessionEndpoint = this.oidcConfig.serverMetadata().end_session_endpoint;
    if (!endSessionEndpoint) {
      return this.appConfig.logoutRedirectUri || '/';
    }

    const params = new URLSearchParams({
      post_logout_redirect_uri: this.appConfig.logoutRedirectUri || '/',
    });

    if (idTokenHint) {
      params.set('id_token_hint', idTokenHint);
    }

    return `${endSessionEndpoint}?${params.toString()}`;
  }
}

export const keycloakService = new KeycloakService();
