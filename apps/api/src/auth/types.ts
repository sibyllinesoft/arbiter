/**
 * Authentication and authorization types
 */

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id?: string;
  issued_at?: number;
}

export interface OAuthService {
  validateToken(token: string): Promise<OAuthToken | null>;
  introspectToken(token: string): Promise<unknown>;
  getTokenInfo(token: string): Promise<unknown>;
}

export interface ProtectedResourceMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
}

export interface OidcMetadata {
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
  authorize(params: unknown): Promise<string>;
  getTokenFromCode(code: string, clientId: string, clientSecret: string): Promise<OAuthToken>;
  refreshToken(refreshToken: string): Promise<OAuthToken>;
}

export interface OAuthIntegrationAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  createOAuthService(): OAuthService;
  createAuthorizationServer(): AuthorizationServer | null;
  createOAuthProvider(): OAuthProvider | null;
  getProtectedResourceMetadata(): ProtectedResourceMetadata | null;
  stop(): Promise<void>;
}

export interface TokenRecord {
  userId: string;
  projectAccess: string[];
}

export interface AuthMiddlewareResult {
  authorized: boolean;
  authContext?: import("../util/types").AuthContext;
  response?: Response;
}

export interface OAuthConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  jwksUri?: string;
  scopes?: string[];
}
