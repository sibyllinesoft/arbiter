/**
 * @module auth
 * Authentication and authorization module.
 * Provides token management, OAuth integration, and middleware.
 */

export type {
  OAuthToken,
  OAuthService,
  ProtectedResourceMetadata,
  OidcMetadata,
  AuthorizationServer,
  OAuthProvider,
  OAuthIntegrationAdapter,
  TokenRecord,
  AuthMiddlewareResult,
  OAuthConfig,
} from "./types";

export { HybridTokenStore } from "./HybridTokenStore";
export { AuthService } from "./AuthService";
export { SupertokensOAuthAdapter } from "./SupertokensOAuthAdapter";
