import { Router, Request, Response } from 'express';
import * as client from 'openid-client';
import { keycloakService } from '../services/keycloak';
import { recordAudit } from '../services/audit';
import { logger } from '../logger';

export const keycloakRouter = Router();

declare module 'express-session' {
  interface SessionData {
    keycloakState?: string;
    keycloakNonce?: string;
    keycloakCodeVerifier?: string;
    keycloakIdToken?: string;
  }
}

keycloakRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    enabled: keycloakService.isConfigured(),
    message: keycloakService.isConfigured() 
      ? 'Keycloak SSO is available'
      : 'Keycloak SSO is not configured. Set KEYCLOAK_BASE_URL, KEYCLOAK_REALM, and KEYCLOAK_CLIENT_ID to enable.',
  });
});

keycloakRouter.get('/login', async (req: Request, res: Response) => {
  try {
    const initialized = await keycloakService.initialize();
    if (!initialized) {
      return res.status(503).json({ 
        error: 'Keycloak SSO is not configured or unavailable' 
      });
    }

    const state = client.randomState();
    const nonce = client.randomNonce();
    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);

    req.session.keycloakState = state;
    req.session.keycloakNonce = nonce;
    req.session.keycloakCodeVerifier = codeVerifier;

    const authUrl = keycloakService.buildAuthorizationUrl(state, nonce, codeChallenge);
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error({ error }, 'Keycloak login initiation failed');
    res.status(500).json({ error: 'Failed to initiate SSO login' });
  }
});

keycloakRouter.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      logger.warn({ error, error_description }, 'Keycloak callback received error');
      return res.redirect(`/login?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/login?error=Missing authorization code or state');
    }

    const expectedState = req.session.keycloakState;
    const expectedNonce = req.session.keycloakNonce;
    const codeVerifier = req.session.keycloakCodeVerifier;

    if (!expectedState || !codeVerifier || !expectedNonce) {
      return res.redirect('/login?error=Session expired, please try again');
    }

    delete req.session.keycloakState;
    delete req.session.keycloakNonce;
    delete req.session.keycloakCodeVerifier;

    const result = await keycloakService.handleCallback(
      code as string,
      state as string,
      expectedState,
      expectedNonce,
      codeVerifier
    );

    if (!result) {
      return res.redirect('/login?error=Authentication failed');
    }

    req.session.userId = result.user.id;
    req.session.username = result.user.username;
    req.session.role = result.user.role;
    req.session.organisationId = result.user.organisationId;

    await recordAudit({
      organisationId: result.user.organisationId,
      eventType: 'USER_LOGIN',
      entityType: 'USER',
      entityId: result.user.id,
      entityName: result.user.name || result.user.username,
      message: `User ${result.user.username} logged in via Keycloak SSO${result.isNewUser ? ' (new account created)' : ''}`,
      context: {
        actorId: result.user.id,
        actorName: result.user.name || result.user.username,
        actorType: 'USER',
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
        userAgent: req.headers['user-agent'] as string,
      },
    });

    res.redirect('/dashboard');
  } catch (error) {
    logger.error({ error }, 'Keycloak callback failed');
    res.redirect('/login?error=SSO authentication failed');
  }
});

keycloakRouter.get('/logout', async (req: Request, res: Response) => {
  try {
    const initialized = await keycloakService.initialize();
    if (!initialized) {
      req.session.destroy(() => {
        res.redirect('/');
      });
      return;
    }

    const idTokenHint = req.session.keycloakIdToken;
    const logoutUrl = keycloakService.getLogoutUrl(idTokenHint);

    req.session.destroy(() => {
      res.redirect(logoutUrl);
    });
  } catch (error) {
    logger.error({ error }, 'Keycloak logout failed');
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
});
