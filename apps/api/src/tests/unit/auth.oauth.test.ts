import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { type JWK, type KeyLike, SignJWT, exportJWK, generateKeyPair } from "jose";
import { AuthService } from "../../auth";
import type { ServerConfig } from "../../types";

const ISSUER = "https://auth.example.com";

async function readBody(init?: RequestInit): Promise<string> {
  if (!init?.body) {
    return "";
  }

  if (typeof init.body === "string") {
    return init.body;
  }

  if (init.body instanceof URLSearchParams) {
    return init.body.toString();
  }

  return await new Response(init.body as BodyInit).text();
}

describe("AuthService SuperTokens OAuth integration", () => {
  let privateKey: KeyLike;
  let publicJwk: JWK;
  let authService: AuthService;
  let originalFetch: typeof fetch;

  beforeAll(async () => {
    const { publicKey, privateKey: priv } = await generateKeyPair("RS256");
    privateKey = priv;
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-kid";
    jwk.alg = "RS256";
    publicJwk = jwk as JWK;
  });

  beforeEach(async () => {
    originalFetch = globalThis.fetch;

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === `${ISSUER}/.well-known/openid-configuration`) {
        return new Response(
          JSON.stringify({
            issuer: ISSUER,
            jwks_uri: `${ISSUER}/jwks.json`,
            token_endpoint: `${ISSUER}/oauth/token`,
            authorization_endpoint: `${ISSUER}/oauth/authorize`,
            revocation_endpoint: `${ISSUER}/oauth/revoke`,
            scopes_supported: ["read", "write", "projects:read"],
            response_types_supported: ["code", "token"],
            grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url === `${ISSUER}/jwks.json`) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url === `${ISSUER}/oauth/token`) {
        const bodyText = await readBody(init);
        const params = new URLSearchParams(bodyText);
        const scope = params.get("scope") ?? "read";

        const signedToken = await new SignJWT({
          scope,
          sub: "user-from-client",
        })
          .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
          .setIssuer(ISSUER)
          .setAudience("arbiter-api")
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(privateKey);

        return new Response(
          JSON.stringify({
            access_token: signedToken,
            token_type: "Bearer",
            expires_in: 3600,
            scope,
            user_id: "user-from-client",
            refresh_token: "refresh-token-value",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url === `${ISSUER}/oauth/revoke`) {
        return new Response("", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    };

    const config: ServerConfig = {
      port: 0,
      host: "localhost",
      database_path: ":memory:",
      spec_workdir: "/tmp/spec-workbench",
      jq_binary_path: "jq",
      auth_required: true,
      rate_limit: { max_tokens: 10, refill_rate: 1, window_ms: 1000 },
      external_tool_timeout_ms: 1000,
      websocket: { max_connections: 10, ping_interval_ms: 1000 },
      oauth: {
        enabled: true,
        mcpBaseUrl: "https://mcp.example.com",
        authServerUrl: ISSUER,
        authServerPort: 443,
        enableAuthServer: true,
        requiredScopes: ["read"],
        clientId: "test-client",
        clientSecret: "test-secret",
      },
    };

    process.env.SUPERTOKENS_OIDC_ISSUER = ISSUER;
    process.env.SUPERTOKENS_CLIENT_ID = "test-client";
    process.env.SUPERTOKENS_CLIENT_SECRET = "test-secret";
    process.env.SUPERTOKENS_REDIRECT_URI = "https://app.example.com/oauth/callback";

    authService = new AuthService(config);
    await authService.startOAuthService();
  });

  afterEach(async () => {
    await authService.stopOAuthService();
    globalThis.fetch = originalFetch;
    delete process.env.SUPERTOKENS_OIDC_ISSUER;
    delete process.env.SUPERTOKENS_CLIENT_ID;
    delete process.env.SUPERTOKENS_CLIENT_SECRET;
    delete process.env.SUPERTOKENS_REDIRECT_URI;
  });

  it("validates tokens issued by SuperTokens", async () => {
    const signedToken = await new SignJWT({
      scope: "read projects:read read:project:demo",
      sub: "user-123",
    })
      .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
      .setIssuer(ISSUER)
      .setAudience("arbiter-api")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const context = await authService.validateOAuthToken(signedToken);
    expect(context).not.toBeNull();
    expect(context?.user_id).toBe("user-123");
    expect(context?.project_access).toContain("demo");
  });

  it("exposes metadata from the discovery document", () => {
    const metadata = authService.getProtectedResourceMetadata();
    expect(metadata).not.toBeNull();
    expect(metadata?.issuer).toBe(ISSUER);
    expect(metadata?.token_endpoint).toBe(`${ISSUER}/oauth/token`);
  });

  it("rejects invalid bearer tokens", async () => {
    const context = await authService.validateOAuthToken("not-a-token");
    expect(context).toBeNull();
  });

  it("issues client credential tokens when authorization server is enabled", async () => {
    const server = authService.getAuthorizationServer();
    expect(server).not.toBeNull();

    const token = await server!.issueToken("test-client", "read");
    expect(token.access_token.length).toBeGreaterThan(10);
    expect(token.scope).toContain("read");
  });
});
