/**
 * Authentication and authorization module
 */
import type { AuthContext, ServerConfig } from './types.ts';
import { logger, parseBearerToken } from './utils.ts';

export class AuthService {
  private validTokens: Set<string> = new Set();
  private tokenToUserMap: Map<string, string> = new Map();
  private userProjectAccess: Map<string, string[]> = new Map();

  constructor(private config: ServerConfig) {
    // Initialize with some default tokens for development
    if (process.env.NODE_ENV === 'development') {
      this.addToken('dev-token', 'dev-user', ['*']);
      logger.info('Development mode: added default auth token');
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
   * Start OAuth service if enabled (placeholder when OAuth is disabled)
   */
  async startOAuthService(): Promise<void> {
    // OAuth functionality requires SuperTokens integration
    // Currently disabled - no OAuth service to start
  }

  /**
   * Stop OAuth service if enabled (placeholder when OAuth is disabled)
   */
  async stopOAuthService(): Promise<void> {
    // OAuth functionality requires SuperTokens integration
    // Currently disabled - no OAuth service to stop
  }

  /**
   * Get OAuth service instance (placeholder when OAuth is disabled)
   */
  getOAuthService(): undefined {
    return undefined;
  }

  /**
   * Get protected resource metadata for OAuth (placeholder when OAuth is disabled)
   */
  getProtectedResourceMetadata(): undefined {
    return undefined;
  }

  /**
   * Get OAuth authorization server instance (placeholder when OAuth is disabled)
   */
  getAuthorizationServer(): undefined {
    return undefined;
  }

  /**
   * Get OAuth provider instance (placeholder when OAuth is disabled)
   */
  getOAuthProvider(): undefined {
    return undefined;
  }

  /**
   * Create OAuth-aware auth middleware (falls back to regular auth when OAuth is disabled)
   */
  createOAuthAwareAuthMiddleware() {
    // When OAuth is disabled, fall back to regular auth middleware
    return this.createAuthMiddleware();
  }
}
