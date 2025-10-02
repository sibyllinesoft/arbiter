import { Hono } from 'hono';
import type { AuthService, ProtectedResourceMetadata } from '../auth.js';
import type { ServerConfig } from '../types.js';

interface Dependencies {
  auth: AuthService;
  config: ServerConfig;
}

function normalizeMetadata(metadata: ProtectedResourceMetadata | null) {
  if (!metadata) {
    return null;
  }

  return {
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    scopes: metadata.scopes_supported,
  };
}

export function createAuthRouter(deps: Dependencies) {
  const app = new Hono();

  app.get('/auth/metadata', c => {
    const { config, auth } = deps;

    if (!config.oauth?.enabled) {
      return c.json({ enabled: false });
    }

    const metadata = normalizeMetadata(auth.getProtectedResourceMetadata());
    const oauthConfig = config.oauth;

    if (!metadata || !metadata.authorizationEndpoint || !metadata.tokenEndpoint) {
      return c.json({
        enabled: false,
        reason: 'metadata_unavailable',
      });
    }

    return c.json({
      enabled: true,
      provider: oauthConfig.provider ?? 'supertokens',
      authorizationEndpoint: metadata.authorizationEndpoint,
      tokenEndpoint: metadata.tokenEndpoint,
      clientId: oauthConfig.clientId ?? null,
      scopes: oauthConfig.requiredScopes ?? [],
      redirectUri: oauthConfig.redirectUri ?? null,
    });
  });

  return app;
}
