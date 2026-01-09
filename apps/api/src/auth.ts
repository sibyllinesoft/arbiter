/**
 * @module auth
 * Authentication and authorization module.
 * Re-exports from auth/ subdirectory for backward compatibility.
 */

export type {
  OAuthToken,
  OAuthService,
  ProtectedResourceMetadata,
  AuthorizationServer,
  OAuthProvider,
} from "./auth/types";

export { AuthService } from "./auth/AuthService";
