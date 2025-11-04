import { Hono } from "hono";
import type { AuthService, ProtectedResourceMetadata } from "../auth.js";
import type { ServerConfig } from "../types.js";

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

  app.get("/auth/metadata", (c) => {
    const { config, auth } = deps;

    if (!config.oauth?.enabled) {
      return c.json({ enabled: false });
    }

    const metadata = normalizeMetadata(auth.getProtectedResourceMetadata());
    const oauthConfig = config.oauth;
    const tokenEpoch = auth.getTokenEpoch();

    if (!metadata || !metadata.authorizationEndpoint || !metadata.tokenEndpoint) {
      return c.json({
        enabled: false,
        reason: "metadata_unavailable",
      });
    }

    return c.json({
      enabled: true,
      provider: oauthConfig.provider ?? "supertokens",
      authorizationEndpoint: metadata.authorizationEndpoint,
      tokenEndpoint: metadata.tokenEndpoint,
      clientId: oauthConfig.clientId ?? null,
      scopes: oauthConfig.requiredScopes ?? [],
      redirectUri: oauthConfig.redirectUri ?? null,
      tokenEpoch: tokenEpoch ?? undefined,
    });
  });

  app.post("/auth/token", async (c) => {
    const { config, auth } = deps;
    if (!config.oauth?.enabled) {
      return c.json(
        {
          success: false,
          error: "oauth_disabled",
          message: "OAuth is not enabled for this deployment.",
        },
        400,
      );
    }

    const provider = auth.getOAuthProvider();
    if (!provider) {
      return c.json(
        {
          success: false,
          error: "oauth_unavailable",
          message: "OAuth provider is not available.",
        },
        503,
      );
    }

    let payload: any;
    try {
      payload = await c.req.json();
    } catch {
      payload = {};
    }

    const code: string | undefined = payload?.code;
    if (!code || typeof code !== "string") {
      return c.json(
        {
          success: false,
          error: "invalid_request",
          message: "Authorization code is required.",
        },
        400,
      );
    }

    try {
      const token = await provider.getTokenFromCode(
        code,
        config.oauth?.clientId ?? "",
        config.oauth?.clientSecret ?? "",
      );

      const authContext = await auth.validateOAuthToken(token.access_token);

      return c.json({
        success: true,
        token,
        authContext,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: "token_exchange_failed",
          message:
            error instanceof Error ? error.message : "Failed to exchange authorization code.",
        },
        400,
      );
    }
  });

  return app;
}
