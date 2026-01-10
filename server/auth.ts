import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "@shared/schema";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

const authSecret = process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET || "development-only-secret-change-in-production";

interface OIDCProviderConfig {
  providerId: string;
  discoveryUrl?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  pkce?: boolean;
}

function buildOIDCProviders(): OIDCProviderConfig[] {
  const providers: OIDCProviderConfig[] = [];

  if (process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
    providers.push({
      providerId: "microsoft-entra",
      discoveryUrl: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
      clientId: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      scopes: ["openid", "profile", "email"],
      pkce: true,
    });
    console.log("[Auth] Microsoft Entra ID SSO configured");
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({
      providerId: "google",
      discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scopes: ["openid", "profile", "email"],
      pkce: true,
    });
    console.log("[Auth] Google OIDC configured");
  }

  if (process.env.OKTA_DOMAIN && process.env.OKTA_CLIENT_ID && process.env.OKTA_CLIENT_SECRET) {
    const oktaDomain = process.env.OKTA_DOMAIN.replace(/\/$/, "");
    const authServer = process.env.OKTA_AUTH_SERVER || "default";
    providers.push({
      providerId: "okta",
      discoveryUrl: `${oktaDomain}/oauth2/${authServer}/.well-known/openid-configuration`,
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      scopes: ["openid", "profile", "email"],
      pkce: true,
    });
    console.log(`[Auth] Okta OIDC configured (auth server: ${authServer})`);
  }

  if (process.env.KEYCLOAK_URL && process.env.KEYCLOAK_REALM && process.env.KEYCLOAK_CLIENT_ID && process.env.KEYCLOAK_CLIENT_SECRET) {
    const keycloakUrl = process.env.KEYCLOAK_URL.replace(/\/$/, "");
    const realm = process.env.KEYCLOAK_REALM;
    providers.push({
      providerId: "keycloak",
      discoveryUrl: `${keycloakUrl}/realms/${realm}/.well-known/openid-configuration`,
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      scopes: ["openid", "profile", "email"],
      pkce: true,
    });
    console.log("[Auth] Keycloak OIDC configured");
  }

  if (process.env.OIDC_DISCOVERY_URL && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
    providers.push({
      providerId: process.env.OIDC_PROVIDER_ID || "generic-oidc",
      discoveryUrl: process.env.OIDC_DISCOVERY_URL,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      scopes: (process.env.OIDC_SCOPES || "openid,profile,email").split(",").map(s => s.trim()),
      pkce: process.env.OIDC_PKCE !== "false",
    });
    console.log(`[Auth] Generic OIDC provider '${process.env.OIDC_PROVIDER_ID || "generic-oidc"}' configured`);
  }

  return providers;
}

const oidcProviders = buildOIDCProviders();

export const auth = betterAuth({
  basePath: "/api/auth",
  secret: authSecret,
  
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  user: {
    fields: {
      emailVerified: "emailVerified",
    },
    additionalFields: {
      username: {
        type: "string",
        required: true,
        input: true,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "VIEWER",
        input: false,
      },
      organisationId: {
        type: "string",
        required: true,
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        return await bcrypt.hash(password, SALT_ROUNDS);
      },
      verify: async (data: { password: string; hash: string }) => {
        return await bcrypt.compare(data.password, data.hash);
      },
    },
  },

  plugins: oidcProviders.length > 0
    ? [
        genericOAuth({
          config: oidcProviders,
        }),
      ]
    : [],

  trustedOrigins: ["*"],

  advanced: {
    cookiePrefix: "complianceai",
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubDomainCookies: {
      enabled: false,
    },
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;

export function getConfiguredProviders(): string[] {
  return oidcProviders.map(p => p.providerId);
}
