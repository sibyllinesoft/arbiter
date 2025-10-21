/**
 * Authentication and authorization module
 */
import { Buffer } from "node:buffer";
import {
  type JWTPayload,
  type JWTVerifyOptions,
  type JWTVerifyResult,
  createRemoteJWKSet,
  jwtVerify,
} from "jose";
import type { AuthContext, ServerConfig } from "./types";
import { logger, parseBearerToken } from "./utils";

// OAuth-related interfaces
export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id?: string;
}

export interface OAuthService {
  validateToken(token: string): Promise<OAuthToken | null>;
  introspectToken(token: string): Promise<any>;
  getTokenInfo(token: string): Promise<any>;
}

export interface ProtectedResourceMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
}

interface OidcMetadata {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  introspection_endpoint?: string;
  userinfo_endpoint?: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
}

export interface AuthorizationServer {
  issueToken(clientId: string, scope: string): Promise<OAuthToken>;
  validateClient(clientId: string, clientSecret: string): Promise<boolean>;
  revokeToken(token: string): Promise<boolean>;
}

export interface OAuthProvider {
  authorize(params: any): Promise<string>;
  getTokenFromCode(code: string, clientId: string, clientSecret: string): Promise<OAuthToken>;
  refreshToken(refreshToken: string): Promise<OAuthToken>;
}

interface OAuthIntegrationAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  createOAuthService(): OAuthService;
  createAuthorizationServer(): AuthorizationServer | null;
  createOAuthProvider(): OAuthProvider | null;
  getProtectedResourceMetadata(): ProtectedResourceMetadata | null;
  stop(): Promise<void>;
}

export class AuthService {
  private validTokens: Set<string> = new Set();
  private tokenToUserMap: Map<string, string> = new Map();
  private userProjectAccess: Map<string, string[]> = new Map();
  private oauthService: OAuthService | null = null;
  private authorizationServer: AuthorizationServer | null = null;
  private oauthProvider: OAuthProvider | null = null;
  private oauthAdapter: OAuthIntegrationAdapter | null = null;

  constructor(private config: ServerConfig) {
    // Initialize with development tokens only in development mode
    const devTokensEnabled =
      process.env.NODE_ENV === "development" && process.env.DISABLE_DEV_AUTH_TOKEN !== "1";

    if (devTokensEnabled) {
      const devToken = process.env.DEV_AUTH_TOKEN || "dev-token";
      const devUser = process.env.DEV_AUTH_USER || "dev-user";

      this.addToken(devToken, devUser, ["*"]);

      logger.warn("DEVELOPMENT MODE: Authentication tokens configured!", {
        devToken: `${devToken.substring(0, 4)}...`,
        devUser,
        warning: "This should NEVER be enabled in production!",
      });
    }

    // Fail-safe: Ensure no dev tokens in production
    if (process.env.NODE_ENV === "production" && this.validTokens.has("dev-token")) {
      throw new Error("SECURITY ERROR: Development tokens detected in production environment!");
    }
  }

  /**
   * Add a valid token with user and project access
   */
  addToken(token: string, userId: string, projectAccess: string[] = []): void {
    this.validTokens.add(token);
    this.tokenToUserMap.set(token, userId);
    this.userProjectAccess.set(userId, projectAccess);

    logger.info("Token added for user", {
      userId,
      projectCount: projectAccess.length,
    });
  }

  /**
   * Remove a token
   */
  removeToken(token: string): void {
    const userId = this.tokenToUserMap.get(token);

    this.validTokens.delete(token);
    this.tokenToUserMap.delete(token);

    if (userId) {
      this.userProjectAccess.delete(userId);
      logger.info("Token removed for user", { userId });
    }
  }

  /**
   * Validate token and return auth context
   */
  validateToken(token: string): AuthContext | null {
    if (!this.validTokens.has(token)) {
      return null;
    }

    const userId = this.tokenToUserMap.get(token);
    const projectAccess = userId ? (this.userProjectAccess.get(userId) ?? []) : [];

    return {
      token,
      user_id: userId,
      project_access: projectAccess,
    };
  }

  /**
   * Check if user has access to a specific project
   */
  hasProjectAccess(authContext: AuthContext, projectId: string): boolean {
    // Wildcard access
    if (authContext.project_access.includes("*")) {
      return true;
    }

    // Specific project access
    return authContext.project_access.includes(projectId);
  }

  /**
   * Extract and validate auth context from request headers
   */
  async authenticateRequest(headers: Headers): Promise<AuthContext | null> {
    if (!this.config.auth_required) {
      // Return a default context when auth is disabled
      return {
        token: "no-auth",
        user_id: "anonymous",
        project_access: ["*"],
      };
    }

    const authHeader = headers.get("authorization");
    const token = parseBearerToken(authHeader ?? undefined);

    if (!token) {
      return null;
    }

    return this.validateToken(token);
  }

  /**
   * Create auth middleware for HTTP requests
   */
  createAuthMiddleware() {
    return async (
      request: Request,
    ): Promise<{
      authorized: boolean;
      authContext?: AuthContext;
      response?: Response;
    }> => {
      try {
        const authContext = await this.authenticateRequest(request.headers);

        if (!authContext) {
          return {
            authorized: false,
            response: new Response(
              JSON.stringify({
                type: "https://httpstatuses.com/401",
                title: "Unauthorized",
                status: 401,
                detail: "Valid bearer token required",
              }),
              {
                status: 401,
                headers: {
                  "Content-Type": "application/problem+json",
                  "WWW-Authenticate": "Bearer",
                },
              },
            ),
          };
        }

        return { authorized: true, authContext };
      } catch (error) {
        logger.error("Auth middleware error", error instanceof Error ? error : undefined);

        return {
          authorized: false,
          response: new Response(
            JSON.stringify({
              type: "https://httpstatuses.com/500",
              title: "Internal Server Error",
              status: 500,
              detail: "Authentication service error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/problem+json" },
            },
          ),
        };
      }
    };
  }

  /**
   * Create project access middleware
   */
  createProjectAccessMiddleware() {
    return (
      authContext: AuthContext,
      projectId: string,
    ): {
      authorized: boolean;
      response?: Response;
    } => {
      if (!this.hasProjectAccess(authContext, projectId)) {
        return {
          authorized: false,
          response: new Response(
            JSON.stringify({
              type: "https://httpstatuses.com/403",
              title: "Forbidden",
              status: 403,
              detail: `Access denied to project: ${projectId}`,
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/problem+json" },
            },
          ),
        };
      }

      return { authorized: true };
    };
  }

  /**
   * Get user info for a token
   */
  getUserInfo(token: string): { userId?: string; projectAccess: string[] } | null {
    const userId = this.tokenToUserMap.get(token);
    if (!userId) {
      return null;
    }

    return {
      userId,
      projectAccess: this.userProjectAccess.get(userId) ?? [],
    };
  }

  /**
   * List all active tokens (for admin purposes)
   */
  listTokens(): Array<{
    token: string;
    userId?: string;
    projectCount: number;
  }> {
    return Array.from(this.validTokens).map((token) => {
      const userId = this.tokenToUserMap.get(token);
      const projectAccess = userId ? (this.userProjectAccess.get(userId) ?? []) : [];

      return {
        token: `${token.substring(0, 8)}...`, // Partial token for security
        userId,
        projectCount: projectAccess.length,
      };
    });
  }

  /**
   * Start OAuth service if enabled
   */
  async startOAuthService(): Promise<void> {
    if (!this.config.oauth?.enabled) {
      logger.info("OAuth service disabled, skipping startup");
      return;
    }

    try {
      this.oauthAdapter = this.createOAuthAdapter();
      await this.oauthAdapter.initialize();

      this.oauthService = this.oauthAdapter.createOAuthService();

      if (this.config.oauth.enableAuthServer) {
        this.authorizationServer = this.oauthAdapter.createAuthorizationServer();
        if (this.authorizationServer) {
          logger.info("OAuth Authorization Server started", {
            provider: this.oauthAdapter.name,
            url: this.config.oauth.authServerUrl,
            port: this.config.oauth.authServerPort,
          });
        } else {
          logger.warn("OAuth adapter did not provide an authorization server implementation", {
            provider: this.oauthAdapter.name,
          });
        }
      } else {
        this.authorizationServer = null;
      }

      this.oauthProvider = this.oauthAdapter.createOAuthProvider();

      const metadata = this.oauthAdapter.getProtectedResourceMetadata();

      logger.info("OAuth service started", {
        provider: this.oauthAdapter.name,
        issuer: metadata?.issuer ?? this.config.oauth.authServerUrl,
        authorizationEndpoint: metadata?.authorization_endpoint,
        tokenEndpoint: metadata?.token_endpoint,
        authServerEnabled: this.config.oauth.enableAuthServer,
        requiredScopes: this.config.oauth.requiredScopes || [],
      });
    } catch (error) {
      logger.error("Failed to start OAuth service", error instanceof Error ? error : undefined);
      throw new Error(
        `OAuth service startup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stop OAuth service if enabled
   */
  async stopOAuthService(): Promise<void> {
    if (!this.config.oauth?.enabled) {
      return;
    }

    try {
      if (this.oauthAdapter) {
        await this.oauthAdapter.stop();
      }
      this.oauthService = null;
      this.authorizationServer = null;
      this.oauthProvider = null;
      this.oauthAdapter = null;

      logger.info("OAuth service stopped successfully");
    } catch (error) {
      logger.error("Error stopping OAuth service", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Get OAuth service instance
   */
  getOAuthService(): OAuthService | null {
    return this.oauthService;
  }

  /**
   * Get protected resource metadata for OAuth
   */
  getProtectedResourceMetadata(): ProtectedResourceMetadata | null {
    if (!this.config.oauth?.enabled) {
      return null;
    }

    if (this.oauthAdapter) {
      return this.oauthAdapter.getProtectedResourceMetadata();
    }

    return {
      issuer: this.config.oauth.authServerUrl,
      authorization_endpoint: `${this.config.oauth.authServerUrl}/oauth/authorize`,
      token_endpoint: `${this.config.oauth.authServerUrl}/oauth/token`,
      scopes_supported: this.config.oauth.requiredScopes || ["read", "write"],
      response_types_supported: ["code", "token"],
      grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    };
  }

  /**
   * Get OAuth authorization server instance
   */
  getAuthorizationServer(): AuthorizationServer | null {
    return this.authorizationServer;
  }

  /**
   * Get OAuth provider instance
   */
  getOAuthProvider(): OAuthProvider | null {
    return this.oauthProvider;
  }

  /**
   * Create OAuth-aware auth middleware
   */
  createOAuthAwareAuthMiddleware() {
    if (!this.config.oauth?.enabled) {
      // When OAuth is disabled, fall back to regular auth middleware
      return this.createAuthMiddleware();
    }

    return async (
      request: Request,
    ): Promise<{
      authorized: boolean;
      authContext?: AuthContext;
      response?: Response;
    }> => {
      try {
        const token = parseBearerToken(request.headers.get("authorization") || "");

        if (!token) {
          return {
            authorized: false,
            response: new Response(
              JSON.stringify({
                type: "https://httpstatuses.com/401",
                title: "Unauthorized",
                status: 401,
                detail: "Authorization token required",
              }),
              {
                status: 401,
                headers: {
                  "Content-Type": "application/problem+json",
                  "WWW-Authenticate": "Bearer",
                },
              },
            ),
          };
        }

        // Try OAuth validation first
        if (this.oauthService) {
          const oauthToken = await this.oauthService.validateToken(token);
          if (oauthToken) {
            // Set OAuth context
            const authContext: AuthContext = {
              token,
              user_id: oauthToken.user_id,
              project_access: this.extractProjectAccessFromScope(oauthToken.scope),
            };
            return { authorized: true, authContext };
          }
        }

        // Fall back to regular token validation
        const regularAuthMiddleware = this.createAuthMiddleware();
        return regularAuthMiddleware(request);
      } catch (error) {
        logger.error(
          "OAuth-aware auth middleware error",
          error instanceof Error ? error : undefined,
        );
        return {
          authorized: false,
          response: new Response(
            JSON.stringify({
              type: "https://httpstatuses.com/500",
              title: "Internal Server Error",
              status: 500,
              detail: "Authentication error",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/problem+json" },
            },
          ),
        };
      }
    };
  }

  /**
   * Validate OAuth token and extract user context
   */
  async validateOAuthToken(token: string): Promise<AuthContext | null> {
    if (!this.oauthService) {
      return null;
    }

    try {
      const oauthToken = await this.oauthService.validateToken(token);
      if (!oauthToken) {
        return null;
      }

      return {
        token,
        user_id: oauthToken.user_id,
        project_access: this.extractProjectAccessFromScope(oauthToken.scope),
      };
    } catch (error) {
      logger.error("OAuth token validation failed", error instanceof Error ? error : undefined);
      return null;
    }
  }

  private createOAuthAdapter(): OAuthIntegrationAdapter {
    const oauthConfig = this.config.oauth;
    if (!oauthConfig) {
      throw new Error("OAuth configuration missing while creating adapter");
    }

    const providerId = (oauthConfig.provider ?? "supertokens").toLowerCase();

    switch (providerId) {
      case "supertokens":
      case "super-tokens":
      case "super_tokens":
      case "dev-oauth":
      case "dev_oauth":
      case "devoauth":
        return new SupertokensOAuthAdapter(oauthConfig);
      default:
        throw new Error(`Unsupported OAuth provider: ${oauthConfig.provider ?? providerId}`);
    }
  }

  /**
   * Extract project access from OAuth scope
   */
  private extractProjectAccessFromScope(scope: string): string[] {
    // Parse scope string to extract project access
    // Format: "read:project:proj1 write:project:proj2" etc.
    const scopes = scope.split(" ");
    const projectAccess = new Set<string>();

    for (const scopeItem of scopes) {
      const match = scopeItem.match(/^(read|write):project:(.+)$/);
      if (match) {
        projectAccess.add(match[2]);
      }
    }

    return Array.from(projectAccess);
  }
}
class SupertokensOAuthAdapter implements OAuthIntegrationAdapter {
  public readonly name = "supertokens";

  private metadataPromise: Promise<OidcMetadata> | null = null;
  private metadataCache: OidcMetadata | null = null;
  private remoteJwkSet: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly config: NonNullable<ServerConfig["oauth"]>) {}

  async initialize(): Promise<void> {
    await this.ensureMetadataReady();
  }

  async stop(): Promise<void> {
    this.metadataPromise = null;
    this.metadataCache = null;
    this.remoteJwkSet = null;
  }

  createOAuthService(): OAuthService {
    const adapter = this;

    return {
      async validateToken(token: string): Promise<OAuthToken | null> {
        const verification = await adapter.verifyOAuthJwt(token);
        if (!verification) {
          return null;
        }

        const {
          result: { payload },
        } = verification;

        const scope = adapter.extractScopeFromPayload(payload);
        const userId = adapter.extractUserIdFromPayload(payload);
        const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";

        return {
          access_token: token,
          token_type: tokenType,
          expires_in: adapter.computeExpiresIn(payload),
          scope,
          user_id: userId,
        };
      },

      async introspectToken(token: string): Promise<any> {
        const verification = await adapter.verifyOAuthJwt(token);
        if (!verification) {
          return {
            active: false,
            tokenPrefix: token.substring(0, 8),
          };
        }

        const { result, metadata } = verification;
        const { payload, protectedHeader } = result;

        const scope = adapter.extractScopeFromPayload(payload);
        const userId = adapter.extractUserIdFromPayload(payload);
        const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";

        return {
          active: true,
          scope,
          token_type: tokenType,
          client_id: typeof payload.client_id === "string" ? payload.client_id : undefined,
          username: userId,
          sub: typeof payload.sub === "string" ? payload.sub : undefined,
          iss: payload.iss ?? metadata.issuer,
          aud: payload.aud,
          exp: payload.exp,
          iat: payload.iat,
          nbf: payload.nbf,
          header: protectedHeader,
          claims: payload,
        };
      },

      async getTokenInfo(token: string): Promise<any> {
        const verification = await adapter.verifyOAuthJwt(token);
        if (!verification) {
          return null;
        }

        const { result, metadata } = verification;
        return {
          issuer: metadata.issuer,
          payload: result.payload,
          header: result.protectedHeader,
        };
      },
    };
  }

  createAuthorizationServer(): AuthorizationServer | null {
    if (!this.config.enableAuthServer) {
      return null;
    }

    const adapter = this;

    return {
      async issueToken(clientId: string, scope: string): Promise<OAuthToken> {
        const resolvedClientId = adapter.resolveClientId(clientId);
        if (!resolvedClientId) {
          throw new Error("OAuth client ID is required to issue tokens");
        }

        const clientSecret = adapter.resolveClientSecret(resolvedClientId);
        if (!clientSecret) {
          throw new Error(`Missing OAuth client secret for ${resolvedClientId}`);
        }

        const metadata = await adapter.getOidcMetadata();
        if (!metadata.token_endpoint) {
          throw new Error("OAuth token endpoint not available in discovery document");
        }

        const params = new URLSearchParams({
          grant_type: "client_credentials",
          scope,
        });

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${resolvedClientId}:${clientSecret}`, "utf-8").toString("base64")}`,
        };

        const response = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const errorBody = (await response.text()).slice(0, 500);
          logger.error("SuperTokens client credentials grant failed", undefined, {
            status: response.status,
            statusText: response.statusText,
            clientId: resolvedClientId,
            scope,
            body: errorBody,
          });
          throw new Error(`Failed to issue OAuth token: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return adapter.normalizeTokenResponse(json, scope);
      },

      async validateClient(clientId: string, clientSecret: string): Promise<boolean> {
        const expected = adapter.resolveClientSecret(clientId);
        if (expected) {
          return expected === clientSecret;
        }

        try {
          const metadata = await adapter.getOidcMetadata();
          if (!metadata.token_endpoint) {
            return false;
          }

          const params = new URLSearchParams({
            grant_type: "client_credentials",
            scope: "validate",
          });

          const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`,
          };

          const response = await fetch(metadata.token_endpoint, {
            method: "POST",
            headers,
            body: params.toString(),
          });

          return response.ok;
        } catch (error) {
          logger.warn("SuperTokens client validation failed", {
            clientId,
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      },

      async revokeToken(token: string): Promise<boolean> {
        try {
          const metadata = await adapter.getOidcMetadata();
          if (!metadata.revocation_endpoint) {
            logger.warn("SuperTokens metadata missing revocation endpoint");
            return false;
          }

          const clientId = adapter.resolveClientId();
          const clientSecret = adapter.resolveClientSecret(clientId ?? undefined);

          const params = new URLSearchParams({
            token,
            token_type_hint: "access_token",
          });

          const headers: Record<string, string> = {
            "Content-Type": "application/x-www-form-urlencoded",
          };

          if (clientId && clientSecret) {
            headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`;
          }

          const response = await fetch(metadata.revocation_endpoint, {
            method: "POST",
            headers,
            body: params.toString(),
          });

          return response.ok;
        } catch (error) {
          logger.warn("SuperTokens token revocation failed", {
            tokenPrefix: token.substring(0, 8),
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        }
      },
    };
  }

  createOAuthProvider(): OAuthProvider | null {
    const adapter = this;

    return {
      async authorize(params: any): Promise<string> {
        const metadata = await adapter.getOidcMetadata();
        if (!metadata.authorization_endpoint) {
          throw new Error("OAuth authorization endpoint not available in discovery document");
        }

        const query = new URLSearchParams();
        const entries = params && typeof params === "object" ? Object.entries(params) : [];
        for (const [key, value] of entries) {
          if (value === undefined || value === null) {
            continue;
          }
          query.set(key, String(value));
        }

        if (!query.has("response_type")) {
          query.set("response_type", "code");
        }

        if (!query.has("client_id")) {
          const clientId = adapter.resolveClientId();
          if (clientId) {
            query.set("client_id", clientId);
          }
        }

        if (!query.has("scope")) {
          const requiredScopes = adapter.config.requiredScopes;
          if (Array.isArray(requiredScopes) && requiredScopes.length) {
            query.set("scope", requiredScopes.join(" "));
          }
        }

        const endpoint = new URL(metadata.authorization_endpoint);
        endpoint.search = query.toString();

        logger.debug("Generated SuperTokens authorization URL", {
          endpoint: metadata.authorization_endpoint,
          hasState: query.has("state"),
        });

        return endpoint.toString();
      },

      async getTokenFromCode(
        code: string,
        clientId: string,
        clientSecret: string,
      ): Promise<OAuthToken> {
        const metadata = await adapter.getOidcMetadata();
        if (!metadata.token_endpoint) {
          throw new Error("OAuth token endpoint not available in discovery document");
        }

        const resolvedClientId = adapter.resolveClientId(clientId);
        const resolvedSecret = adapter.resolveClientSecret(
          resolvedClientId ?? undefined,
          clientSecret,
        );

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };

        const params = new URLSearchParams({
          grant_type: "authorization_code",
          code,
        });

        const redirectUri = adapter.getRedirectUri();
        if (redirectUri) {
          params.set("redirect_uri", redirectUri);
        }

        if (resolvedClientId && resolvedSecret) {
          headers.Authorization = `Basic ${Buffer.from(`${resolvedClientId}:${resolvedSecret}`, "utf-8").toString("base64")}`;
        } else if (resolvedClientId) {
          params.set("client_id", resolvedClientId);
          if (resolvedSecret) {
            params.set("client_secret", resolvedSecret);
          }
        }

        const response = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const errorBody = (await response.text()).slice(0, 500);
          throw new Error(
            `Failed to exchange authorization code: ${response.status} ${response.statusText} ${errorBody}`,
          );
        }

        const json = await response.json();
        return adapter.normalizeTokenResponse(json);
      },

      async refreshToken(refreshToken: string): Promise<OAuthToken> {
        const metadata = await adapter.getOidcMetadata();
        if (!metadata.token_endpoint) {
          throw new Error("OAuth token endpoint not available in discovery document");
        }

        const clientId = adapter.resolveClientId();
        const clientSecret = adapter.resolveClientSecret(clientId ?? undefined);

        const headers: Record<string, string> = {
          "Content-Type": "application/x-www-form-urlencoded",
        };

        const params = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        });

        if (clientId && clientSecret) {
          headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`;
        } else if (clientId) {
          params.set("client_id", clientId);
          if (clientSecret) {
            params.set("client_secret", clientSecret);
          }
        }

        const response = await fetch(metadata.token_endpoint, {
          method: "POST",
          headers,
          body: params.toString(),
        });

        if (!response.ok) {
          const errorBody = (await response.text()).slice(0, 500);
          throw new Error(
            `Failed to refresh OAuth token: ${response.status} ${response.statusText} ${errorBody}`,
          );
        }

        const json = await response.json();
        return adapter.normalizeTokenResponse(json);
      },
    };
  }

  getProtectedResourceMetadata(): ProtectedResourceMetadata | null {
    if (!this.config.enabled) {
      return null;
    }

    const cached = this.metadataCache;
    if (cached) {
      return {
        issuer: cached.issuer,
        authorization_endpoint: cached.authorization_endpoint ?? `${cached.issuer}/oauth/authorize`,
        token_endpoint: cached.token_endpoint ?? `${cached.issuer}/oauth/token`,
        scopes_supported:
          cached.scopes_supported && cached.scopes_supported.length > 0
            ? cached.scopes_supported
            : this.config.requiredScopes || ["read", "write"],
        response_types_supported:
          cached.response_types_supported && cached.response_types_supported.length > 0
            ? cached.response_types_supported
            : ["code", "token"],
        grant_types_supported:
          cached.grant_types_supported && cached.grant_types_supported.length > 0
            ? cached.grant_types_supported
            : ["authorization_code", "client_credentials", "refresh_token"],
      };
    }

    return {
      issuer: this.config.authServerUrl,
      authorization_endpoint: `${this.config.authServerUrl}/oauth/authorize`,
      token_endpoint: `${this.config.authServerUrl}/oauth/token`,
      scopes_supported: this.config.requiredScopes || ["read", "write"],
      response_types_supported: ["code", "token"],
      grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    };
  }

  private async ensureMetadataReady(): Promise<void> {
    await this.getOidcMetadata();
    await this.getRemoteJwkSet();
  }

  private resolveIssuerUrl(): string {
    const candidate =
      process.env.SUPERTOKENS_OIDC_ISSUER?.trim() ||
      process.env.SUPERTOKENS_AUTH_SERVER_URL?.trim() ||
      this.config.issuerOverride?.trim() ||
      this.config.authServerUrl?.trim();

    if (!candidate) {
      throw new Error(
        "OAuth issuer URL is not configured. Set SUPERTOKENS_OIDC_ISSUER or oauth.authServerUrl",
      );
    }

    return candidate.replace(/\/+$/, "");
  }

  private getDiscoveryPath(): string {
    const fromEnv = process.env.SUPERTOKENS_OIDC_DISCOVERY_PATH;
    const fromConfig = this.config.discoveryPath;
    const path = fromEnv?.trim() || fromConfig?.trim() || ".well-known/openid-configuration";
    return path.startsWith("/") ? path.slice(1) : path;
  }

  private getExpectedAudiences(): string[] | undefined {
    const configAudience = Array.isArray(this.config.audience) ? [...this.config.audience] : [];

    const envAudienceRaw =
      process.env.SUPERTOKENS_OIDC_AUDIENCE ?? process.env.OAUTH_EXPECTED_AUDIENCE ?? "";
    const envAudience = envAudienceRaw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const combined = [...configAudience, ...envAudience];
    if (!combined.length) {
      return undefined;
    }

    return Array.from(new Set(combined));
  }

  private async getOidcMetadata(): Promise<OidcMetadata> {
    if (!this.config.enabled) {
      throw new Error("OAuth is not enabled");
    }

    if (this.metadataPromise) {
      return this.metadataPromise;
    }

    const issuer = this.resolveIssuerUrl();
    const discoveryPath = this.getDiscoveryPath();
    const base = issuer.endsWith("/") ? issuer : `${issuer}/`;
    const discoveryUrl = new URL(discoveryPath, base);

    const loadPromise = (async () => {
      const response = await fetch(discoveryUrl, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 256);
        throw new Error(
          `Failed to fetch OAuth discovery document: ${response.status} ${response.statusText} ${body}`,
        );
      }

      const data = (await response.json()) as Partial<OidcMetadata> & Record<string, unknown>;

      if (!data.issuer || !data.jwks_uri) {
        throw new Error("OAuth discovery document missing issuer or jwks_uri");
      }

      const metadata: OidcMetadata = {
        issuer: data.issuer,
        jwks_uri: data.jwks_uri,
        authorization_endpoint: data.authorization_endpoint,
        token_endpoint: data.token_endpoint,
        introspection_endpoint: data.introspection_endpoint,
        userinfo_endpoint: data.userinfo_endpoint,
        revocation_endpoint: data.revocation_endpoint,
        scopes_supported: Array.isArray(data.scopes_supported) ? data.scopes_supported : undefined,
        response_types_supported: Array.isArray(data.response_types_supported)
          ? data.response_types_supported
          : undefined,
        grant_types_supported: Array.isArray(data.grant_types_supported)
          ? data.grant_types_supported
          : undefined,
      };

      this.metadataCache = metadata;

      logger.debug("Loaded SuperTokens OIDC metadata", {
        issuer: metadata.issuer,
        jwksUri: metadata.jwks_uri,
        tokenEndpoint: metadata.token_endpoint,
      });

      return metadata;
    })();

    this.metadataPromise = loadPromise.catch((error) => {
      this.metadataPromise = null;
      throw error;
    });

    return this.metadataPromise;
  }

  private async getRemoteJwkSet(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (!this.config.enabled) {
      throw new Error("OAuth is not enabled");
    }

    if (this.remoteJwkSet) {
      return this.remoteJwkSet;
    }

    const metadata = await this.getOidcMetadata();

    try {
      this.remoteJwkSet = createRemoteJWKSet(new URL(metadata.jwks_uri));
      return this.remoteJwkSet;
    } catch (error) {
      this.remoteJwkSet = null;
      throw error instanceof Error
        ? new Error(`Failed to initialize remote JWKS: ${error.message}`)
        : error;
    }
  }

  private async verifyOAuthJwt(
    token: string,
  ): Promise<{ result: JWTVerifyResult; metadata: OidcMetadata } | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const metadata = await this.getOidcMetadata();
      const jwkSet = await this.getRemoteJwkSet();

      const verifyOptions: JWTVerifyOptions = {
        issuer: metadata.issuer,
        clockTolerance: 5,
      };

      const audiences = this.getExpectedAudiences();
      if (audiences && audiences.length > 0) {
        verifyOptions.audience = audiences.length === 1 ? audiences[0] : audiences;
      }

      const result = await jwtVerify(token, jwkSet, verifyOptions);
      return { result, metadata };
    } catch (error) {
      logger.warn("SuperTokens OAuth token verification failed", {
        reason: error instanceof Error ? error.message : String(error),
        tokenPrefix: token.substring(0, 8),
      });
      return null;
    }
  }

  private extractScopeFromPayload(payload: JWTPayload): string {
    if (typeof payload.scope === "string" && payload.scope.length > 0) {
      return payload.scope;
    }

    const anyPayload = payload as Record<string, unknown>;

    if (Array.isArray(anyPayload.scope)) {
      const values = (anyPayload.scope as unknown[]).filter(
        (value): value is string => typeof value === "string",
      );
      if (values.length) {
        return values.join(" ");
      }
    }

    if (Array.isArray(anyPayload.scp)) {
      const values = (anyPayload.scp as unknown[]).filter(
        (value): value is string => typeof value === "string",
      );
      if (values.length) {
        return values.join(" ");
      }
    }

    if (Array.isArray(anyPayload.permissions)) {
      const values = (anyPayload.permissions as unknown[]).filter(
        (value): value is string => typeof value === "string",
      );
      if (values.length) {
        return values.join(" ");
      }
    }

    if (typeof anyPayload.scp === "string" && anyPayload.scp.length > 0) {
      return anyPayload.scp;
    }

    if (typeof anyPayload.permissions === "string" && anyPayload.permissions.length > 0) {
      return anyPayload.permissions;
    }

    const requiredScopes = this.config.requiredScopes;
    if (Array.isArray(requiredScopes) && requiredScopes.length > 0) {
      return requiredScopes.join(" ");
    }

    return "";
  }

  private extractUserIdFromPayload(payload: JWTPayload): string | undefined {
    if (typeof payload.sub === "string" && payload.sub.length > 0) {
      return payload.sub;
    }

    const anyPayload = payload as Record<string, unknown>;

    for (const key of ["user_id", "userId", "uid", "sessionHandle"]) {
      const value = anyPayload[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private computeExpiresIn(payload: JWTPayload): number {
    if (typeof payload.exp !== "number") {
      return 0;
    }

    const milliseconds = payload.exp * 1000 - Date.now();
    if (milliseconds <= 0) {
      return 0;
    }

    return Math.floor(milliseconds / 1000);
  }

  private normalizeTokenResponse(response: any, fallbackScope?: string): OAuthToken {
    if (!response || typeof response !== "object") {
      throw new Error("Invalid OAuth token response");
    }

    const record = response as Record<string, any>;
    const accessToken = record.access_token;
    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new Error("OAuth token response missing access_token");
    }

    const tokenType =
      typeof record.token_type === "string" && record.token_type.length > 0
        ? record.token_type
        : "Bearer";

    const expiresRaw = record.expires_in;
    const expiresIn =
      typeof expiresRaw === "number"
        ? expiresRaw
        : typeof expiresRaw === "string"
          ? Number.parseInt(expiresRaw, 10) || 0
          : 0;

    const scopeValue = record.scope;
    let scope = "";

    if (typeof scopeValue === "string") {
      scope = scopeValue;
    } else if (Array.isArray(scopeValue)) {
      scope = scopeValue
        .filter((value: unknown): value is string => typeof value === "string")
        .join(" ");
    } else if (fallbackScope) {
      scope = fallbackScope;
    } else {
      const requiredScopes = this.config.requiredScopes;
      if (Array.isArray(requiredScopes) && requiredScopes.length > 0) {
        scope = requiredScopes.join(" ");
      }
    }

    const userId =
      typeof record.user_id === "string"
        ? record.user_id
        : typeof record.sub === "string"
          ? record.sub
          : undefined;

    return {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      scope,
      user_id: userId,
    };
  }

  private resolveClientId(candidate?: string): string | undefined {
    if (candidate && candidate.length > 0) {
      return candidate;
    }

    if (this.config.clientId && this.config.clientId.length > 0) {
      return this.config.clientId;
    }

    const envClientId =
      process.env.SUPERTOKENS_CLIENT_ID ?? process.env.OAUTH_CLIENT_ID ?? process.env.CLIENT_ID;

    if (envClientId && envClientId.length > 0) {
      return envClientId;
    }

    return undefined;
  }

  private resolveClientSecret(clientId?: string, explicitSecret?: string | null): string | null {
    if (explicitSecret && explicitSecret.length > 0) {
      return explicitSecret;
    }

    if (clientId && clientId.length > 0) {
      const envKey = `OAUTH_CLIENT_${clientId.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_SECRET`;
      const keyedSecret = process.env[envKey];
      if (keyedSecret && keyedSecret.length > 0) {
        return keyedSecret;
      }

      if (this.config.clientId === clientId && this.config.clientSecret) {
        return this.config.clientSecret;
      }

      if (process.env.SUPERTOKENS_CLIENT_ID === clientId && process.env.SUPERTOKENS_CLIENT_SECRET) {
        return process.env.SUPERTOKENS_CLIENT_SECRET;
      }
    }

    if (this.config.clientSecret) {
      return this.config.clientSecret;
    }

    const envSecret =
      process.env.SUPERTOKENS_CLIENT_SECRET ??
      process.env.OAUTH_CLIENT_SECRET ??
      process.env.CLIENT_SECRET;

    return envSecret && envSecret.length > 0 ? envSecret : null;
  }

  private getRedirectUri(): string | null {
    const candidate =
      process.env.SUPERTOKENS_REDIRECT_URI ??
      process.env.OAUTH_REDIRECT_URI ??
      this.config.redirectUri;
    return candidate && candidate.length > 0 ? candidate : null;
  }
}
