/**
 * Authentication routes for OAuth token exchange and metadata retrieval.
 * Provides endpoints for client-side OAuth flow integration.
 */
import { Hono } from "hono";
import type { AuthService, ProtectedResourceMetadata } from "../../auth";
import type { ServerConfig } from "../../util/types";

/** Dependencies required by the auth router */
interface Dependencies {
  auth: AuthService;
  config: ServerConfig;
}

/** Standard error response structure */
interface ErrorResponse {
  success: false;
  error: string;
  message: string;
}

/** Create a standardized error response */
function createErrorResponse(error: string, message: string): ErrorResponse {
  return { success: false, error, message };
}

/** Normalize OAuth metadata to a client-friendly format */
function normalizeMetadata(metadata: ProtectedResourceMetadata | null) {
  if (!metadata) return null;
  return {
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    scopes: metadata.scopes_supported,
  };
}

/** Check if metadata has required OAuth endpoints */
function hasValidEndpoints(metadata: ReturnType<typeof normalizeMetadata>): boolean {
  return !!(metadata?.authorizationEndpoint && metadata?.tokenEndpoint);
}

/** Build the full metadata response object */
function buildMetadataResponse(
  metadata: NonNullable<ReturnType<typeof normalizeMetadata>>,
  oauthConfig: NonNullable<ServerConfig["oauth"]>,
  tokenEpoch: string | null,
) {
  return {
    enabled: true,
    provider: oauthConfig.provider ?? "supertokens",
    authorizationEndpoint: metadata.authorizationEndpoint,
    tokenEndpoint: metadata.tokenEndpoint,
    clientId: oauthConfig.clientId ?? null,
    scopes: oauthConfig.requiredScopes ?? [],
    redirectUri: oauthConfig.redirectUri ?? null,
    tokenEpoch: tokenEpoch ?? undefined,
  };
}

/** Safely parse JSON from request body */
async function parseJsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<
  Record<string, unknown>
> {
  try {
    const result = await c.req.json();
    return typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Extract and validate authorization code from payload */
function extractAuthCode(payload: Record<string, unknown>): string | null {
  const code = payload?.code;
  return typeof code === "string" && code ? code : null;
}

/**
 * Create the authentication router with OAuth endpoints.
 * Provides /auth/metadata for discovery and /auth/token for code exchange.
 */
export function createAuthRouter(deps: Dependencies) {
  const app = new Hono();

  app.get("/auth/metadata", (c) => {
    const { config, auth } = deps;

    if (!config.oauth?.enabled) {
      return c.json({ enabled: false });
    }

    const metadata = normalizeMetadata(auth.getProtectedResourceMetadata());
    const tokenEpoch = auth.getTokenEpoch();

    if (!hasValidEndpoints(metadata)) {
      return c.json({ enabled: false, reason: "metadata_unavailable" });
    }

    return c.json(buildMetadataResponse(metadata!, config.oauth, tokenEpoch));
  });

  app.post("/auth/token", async (c) => {
    const { config, auth } = deps;

    if (!config.oauth?.enabled) {
      return c.json(
        createErrorResponse("oauth_disabled", "OAuth is not enabled for this deployment."),
        400,
      );
    }

    const provider = auth.getOAuthProvider();
    if (!provider) {
      return c.json(
        createErrorResponse("oauth_unavailable", "OAuth provider is not available."),
        503,
      );
    }

    const payload = await parseJsonBody(c);
    const code = extractAuthCode(payload);

    if (!code) {
      return c.json(createErrorResponse("invalid_request", "Authorization code is required."), 400);
    }

    try {
      const token = await provider.getTokenFromCode(
        code,
        config.oauth?.clientId ?? "",
        config.oauth?.clientSecret ?? "",
      );

      const authContext = await auth.validateOAuthToken(token.access_token);

      return c.json({ success: true, token, authContext });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to exchange authorization code.";
      return c.json(createErrorResponse("token_exchange_failed", message), 400);
    }
  });

  return app;
}
