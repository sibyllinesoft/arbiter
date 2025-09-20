/**
 * Authentication and authorization module
 */
import type { AuthContext, ServerConfig } from './types.ts';
import { logger, parseBearerToken } from './utils.ts';

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

export class AuthService {
  private validTokens: Set<string> = new Set();
  private tokenToUserMap: Map<string, string> = new Map();
  private userProjectAccess: Map<string, string[]> = new Map();
  private oauthService: OAuthService | null = null;
  private authorizationServer: AuthorizationServer | null = null;
  private oauthProvider: OAuthProvider | null = null;

  constructor(private config: ServerConfig) {
    // Initialize with development tokens only in development mode
    if (process.env.NODE_ENV === 'development') {
      const devToken = process.env.DEV_AUTH_TOKEN || 'dev-token';
      const devUser = process.env.DEV_AUTH_USER || 'dev-user';

      this.addToken(devToken, devUser, ['*']);

      logger.warn('DEVELOPMENT MODE: Authentication tokens configured!', {
        devToken: `${devToken.substring(0, 4)}...`,
        devUser,
        warning: 'This should NEVER be enabled in production!',
      });
    }

    // Fail-safe: Ensure no dev tokens in production
    if (process.env.NODE_ENV === 'production' && this.validTokens.has('dev-token')) {
      throw new Error('SECURITY ERROR: Development tokens detected in production environment!');
    }
  }

  /**
   * Add a valid token with user and project access
   */
  addToken(token: string, userId: string, projectAccess: string[] = []): void {
    this.validTokens.add(token);
    this.tokenToUserMap.set(token, userId);
    this.userProjectAccess.set(userId, projectAccess);

    logger.info('Token added for user', {
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
      logger.info('Token removed for user', { userId });
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
    if (authContext.project_access.includes('*')) {
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
        token: 'no-auth',
        user_id: 'anonymous',
        project_access: ['*'],
      };
    }

    const authHeader = headers.get('authorization');
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
      request: Request
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
                type: 'https://httpstatuses.com/401',
                title: 'Unauthorized',
                status: 401,
                detail: 'Valid bearer token required',
              }),
              {
                status: 401,
                headers: {
                  'Content-Type': 'application/problem+json',
                  'WWW-Authenticate': 'Bearer',
                },
              }
            ),
          };
        }

        return { authorized: true, authContext };
      } catch (error) {
        logger.error('Auth middleware error', error instanceof Error ? error : undefined);

        return {
          authorized: false,
          response: new Response(
            JSON.stringify({
              type: 'https://httpstatuses.com/500',
              title: 'Internal Server Error',
              status: 500,
              detail: 'Authentication service error',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/problem+json' },
            }
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
      projectId: string
    ): {
      authorized: boolean;
      response?: Response;
    } => {
      if (!this.hasProjectAccess(authContext, projectId)) {
        return {
          authorized: false,
          response: new Response(
            JSON.stringify({
              type: 'https://httpstatuses.com/403',
              title: 'Forbidden',
              status: 403,
              detail: `Access denied to project: ${projectId}`,
            }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/problem+json' },
            }
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
    return Array.from(this.validTokens).map(token => {
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
      logger.info('OAuth service disabled, skipping startup');
      return;
    }

    try {
      // Initialize OAuth service components
      this.oauthService = this.createOAuthServiceInstance();

      if (this.config.oauth.enableAuthServer) {
        this.authorizationServer = this.createAuthorizationServerInstance();
        logger.info('OAuth Authorization Server started', {
          url: this.config.oauth.authServerUrl,
          port: this.config.oauth.authServerPort,
        });
      }

      this.oauthProvider = this.createOAuthProviderInstance();

      logger.info('OAuth service started successfully', {
        authServerEnabled: this.config.oauth.enableAuthServer,
        mcpBaseUrl: this.config.oauth.mcpBaseUrl,
        requiredScopes: this.config.oauth.requiredScopes || [],
      });
    } catch (error) {
      logger.error('Failed to start OAuth service', { error });
      throw new Error(
        `OAuth service startup failed: ${error instanceof Error ? error.message : String(error)}`
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
      this.oauthService = null;
      this.authorizationServer = null;
      this.oauthProvider = null;

      logger.info('OAuth service stopped successfully');
    } catch (error) {
      logger.error('Error stopping OAuth service', { error });
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

    return {
      issuer: this.config.oauth.authServerUrl,
      authorization_endpoint: `${this.config.oauth.authServerUrl}/oauth/authorize`,
      token_endpoint: `${this.config.oauth.authServerUrl}/oauth/token`,
      scopes_supported: this.config.oauth.requiredScopes || ['read', 'write'],
      response_types_supported: ['code', 'token'],
      grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'],
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

    return async (req: any, res: any, next: any) => {
      try {
        const token = parseBearerToken(req.headers.authorization || '');

        if (!token) {
          return res.status(401).json({ error: 'Authorization token required' });
        }

        // Try OAuth validation first
        if (this.oauthService) {
          const oauthToken = await this.oauthService.validateToken(token);
          if (oauthToken) {
            // Set OAuth context
            req.auth = {
              token,
              user_id: oauthToken.user_id,
              project_access: this.extractProjectAccessFromScope(oauthToken.scope),
              oauth_token: oauthToken,
            } as AuthContext;
            return next();
          }
        }

        // Fall back to regular token validation
        const regularAuthMiddleware = this.createAuthMiddleware();
        return regularAuthMiddleware(req, res, next);
      } catch (error) {
        logger.error('OAuth-aware auth middleware error', { error });
        return res.status(500).json({ error: 'Authentication error' });
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
        oauth_token: oauthToken,
      };
    } catch (error) {
      logger.error('OAuth token validation failed', { error });
      return null;
    }
  }

  /**
   * Extract project access from OAuth scope
   */
  private extractProjectAccessFromScope(scope: string): string[] {
    // Parse scope string to extract project access
    // Format: "read:project:proj1 write:project:proj2" etc.
    const scopes = scope.split(' ');
    const projectAccess = new Set<string>();

    for (const scopeItem of scopes) {
      const match = scopeItem.match(/^(read|write):project:(.+)$/);
      if (match) {
        projectAccess.add(match[2]);
      }
    }

    return Array.from(projectAccess);
  }

  /**
   * Create OAuth service instance (stub implementation)
   */
  private createOAuthServiceInstance(): OAuthService {
    return {
      async validateToken(token: string): Promise<OAuthToken | null> {
        // Stub implementation for OAuth token validation
        // In production, this would validate against OAuth server
        logger.debug('OAuth token validation (stub)', { tokenPrefix: token.substring(0, 8) });

        // For development, accept tokens that start with 'oauth_'
        if (token.startsWith('oauth_')) {
          return {
            access_token: token,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'read write',
            user_id: 'oauth-user',
          };
        }

        return null;
      },

      async introspectToken(token: string): Promise<any> {
        // Stub implementation for token introspection
        logger.debug('OAuth token introspection (stub)', { tokenPrefix: token.substring(0, 8) });
        return {
          active: token.startsWith('oauth_'),
          client_id: 'arbiter-client',
          username: 'oauth-user',
          scope: 'read write',
        };
      },

      async getTokenInfo(token: string): Promise<any> {
        // Stub implementation for token info
        logger.debug('OAuth token info (stub)', { tokenPrefix: token.substring(0, 8) });
        return {
          sub: 'oauth-user',
          aud: 'arbiter-api',
          iss: 'arbiter-oauth-server',
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      },
    };
  }

  /**
   * Create authorization server instance (stub implementation)
   */
  private createAuthorizationServerInstance(): AuthorizationServer {
    return {
      async issueToken(clientId: string, scope: string): Promise<OAuthToken> {
        // Stub implementation for token issuance
        logger.debug('OAuth token issuance (stub)', { clientId, scope });

        const token = `oauth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        return {
          access_token: token,
          token_type: 'Bearer',
          expires_in: 3600,
          scope,
          user_id: `user_${clientId}`,
        };
      },

      async validateClient(clientId: string, clientSecret: string): Promise<boolean> {
        // Stub implementation for client validation
        logger.debug('OAuth client validation (stub)', { clientId });

        // For development, accept any client with 'arbiter' in the ID
        return clientId.includes('arbiter') && clientSecret.length > 8;
      },

      async revokeToken(token: string): Promise<boolean> {
        // Stub implementation for token revocation
        logger.debug('OAuth token revocation (stub)', { tokenPrefix: token.substring(0, 8) });
        return true;
      },
    };
  }

  /**
   * Create OAuth provider instance (stub implementation)
   */
  private createOAuthProviderInstance(): OAuthProvider {
    return {
      async authorize(params: any): Promise<string> {
        // Stub implementation for OAuth authorization
        logger.debug('OAuth authorization (stub)', { params });

        const code = `auth_code_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        return code;
      },

      async getTokenFromCode(
        code: string,
        clientId: string,
        clientSecret: string
      ): Promise<OAuthToken> {
        // Stub implementation for authorization code exchange
        logger.debug('OAuth code exchange (stub)', { code, clientId });

        const token = `oauth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        return {
          access_token: token,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'read write',
          user_id: `user_${clientId}`,
        };
      },

      async refreshToken(refreshToken: string): Promise<OAuthToken> {
        // Stub implementation for token refresh
        logger.debug('OAuth token refresh (stub)', {
          refreshTokenPrefix: refreshToken.substring(0, 8),
        });

        const token = `oauth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        return {
          access_token: token,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'read write',
          user_id: 'refreshed-user',
        };
      },
    };
  }
}
