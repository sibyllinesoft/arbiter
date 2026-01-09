/**
 * @module auth/AuthService
 * Main authentication service handling token management and OAuth integration.
 */

import { randomUUID } from "node:crypto";
import { logger, parseBearerToken } from "../io/utils";
import type { AuthContext, ServerConfig } from "../util/types";
import { HybridTokenStore } from "./HybridTokenStore";
import { SupertokensOAuthAdapter } from "./SupertokensOAuthAdapter";
import type {
  AuthorizationServer,
  OAuthIntegrationAdapter,
  OAuthProvider,
  OAuthService,
  OAuthToken,
  ProtectedResourceMetadata,
} from "./types";

/**
 * Main authentication service handling token validation and OAuth integration.
 */
export class AuthService {
  private tokenStore: HybridTokenStore;
  private oauthService: OAuthService | null = null;
  private authorizationServer: AuthorizationServer | null = null;
  private oauthProvider: OAuthProvider | null = null;
  private oauthAdapter: OAuthIntegrationAdapter | null = null;
  private tokenEpochId: string | null;
  private tokenEpochIssuedAt: number | null;

  constructor(private config: ServerConfig) {
    const globalAny = globalThis as any;
    const kvBinding =
      globalAny?.AUTH_TOKENS ??
      globalAny?.env?.AUTH_TOKENS ??
      globalAny?.__bindings__?.AUTH_TOKENS ??
      null;
    this.tokenStore = new HybridTokenStore(kvBinding);

    const epochFromEnv = (process.env.AUTH_TOKEN_EPOCH || "").trim();
    if (epochFromEnv.length > 0) {
      this.tokenEpochId = epochFromEnv;
      this.tokenEpochIssuedAt = Math.floor(Date.now() / 1000);
    } else if (process.env.NODE_ENV === "development") {
      this.tokenEpochId = randomUUID();
      this.tokenEpochIssuedAt = Math.floor(Date.now() / 1000);
      logger.debug("Development token epoch initialized", {
        tokenEpoch: this.tokenEpochId,
      });
    } else {
      this.tokenEpochId = null;
      this.tokenEpochIssuedAt = null;
    }

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
    if (process.env.NODE_ENV === "production" && process.env.DEV_AUTH_TOKEN) {
      throw new Error("SECURITY ERROR: Development tokens detected in production environment!");
    }
  }

  /**
   * Add a valid token with user and project access
   */
  addToken(token: string, userId: string, projectAccess: string[] = []): void {
    this.tokenStore.add(token, { userId, projectAccess });
    logger.info("Token added for user", { userId, projectCount: projectAccess.length });
  }

  /**
   * Remove a token
   */
  removeToken(token: string): void {
    this.tokenStore.delete(token);
  }

  /**
   * Validate token and return auth context
   */
  async validateToken(token: string): Promise<AuthContext | null> {
    const record = await this.tokenStore.get(token);
    if (!record) return null;

    return {
      token,
      user_id: record.userId,
      project_access: record.projectAccess,
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

    return await this.validateToken(token);
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
    const record = this.tokenStore.peek(token);
    if (!record) return null;
    return { userId: record.userId, projectAccess: record.projectAccess };
  }

  /**
   * List all active tokens (for admin purposes)
   */
  listTokens(): Array<{
    token: string;
    userId?: string;
    projectCount: number;
  }> {
    return this.tokenStore.entries().map(([token, record]) => {
      const projectAccess = record.projectAccess ?? [];

      return {
        token: `${token.substring(0, 8)}...`, // Partial token for security
        userId: record.userId,
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
            if (!this.isOAuthTokenCurrent(oauthToken)) {
              logger.warn("Rejecting OAuth token due to epoch mismatch");
              return {
                authorized: false,
                response: new Response(
                  JSON.stringify({
                    type: "https://httpstatuses.com/401",
                    title: "Unauthorized",
                    status: 401,
                    detail: "Authentication token is no longer valid. Please sign in again.",
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
      if (!this.isOAuthTokenCurrent(oauthToken)) {
        logger.warn("OAuth token rejected during validation due to epoch mismatch");
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

  getTokenEpoch(): string | null {
    return this.tokenEpochId;
  }

  private isOAuthTokenCurrent(token: OAuthToken): boolean {
    if (this.tokenEpochIssuedAt == null) {
      return true;
    }

    if (typeof token.issued_at !== "number") {
      return true;
    }

    return token.issued_at >= this.tokenEpochIssuedAt;
  }
}
