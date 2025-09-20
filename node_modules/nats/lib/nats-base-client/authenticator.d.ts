import { Auth, Authenticator } from "./core";
export declare function multiAuthenticator(authenticators: Authenticator[]): (nonce?: string) => Auth;
export declare function noAuthFn(): Authenticator;
/**
 * Returns a user/pass authenticator for the specified user and optional password
 * @param { string | () => string } user
 * @param {string | () => string } pass
 * @return {UserPass}
 */
export declare function usernamePasswordAuthenticator(user: string | (() => string), pass?: string | (() => string)): Authenticator;
/**
 * Returns a token authenticator for the specified token
 * @param { string | () => string } token
 * @return {TokenAuth}
 */
export declare function tokenAuthenticator(token: string | (() => string)): Authenticator;
/**
 * Returns an Authenticator that returns a NKeyAuth based that uses the
 * specified seed or function returning a seed.
 * @param {Uint8Array | (() => Uint8Array)} seed - the nkey seed
 * @return {NKeyAuth}
 */
export declare function nkeyAuthenticator(seed?: Uint8Array | (() => Uint8Array)): Authenticator;
/**
 * Returns an Authenticator function that returns a JwtAuth.
 * If a seed is provided, the public key, and signature are
 * calculated.
 *
 * @param {string | ()=>string} ajwt - the jwt
 * @param {Uint8Array | ()=> Uint8Array } seed - the optional nkey seed
 * @return {Authenticator}
 */
export declare function jwtAuthenticator(ajwt: string | (() => string), seed?: Uint8Array | (() => Uint8Array)): Authenticator;
/**
 * Returns an Authenticator function that returns a JwtAuth.
 * This is a convenience Authenticator that parses the
 * specified creds and delegates to the jwtAuthenticator.
 * @param {Uint8Array | () => Uint8Array } creds - the contents of a creds file or a function that returns the creds
 * @returns {JwtAuth}
 */
export declare function credsAuthenticator(creds: Uint8Array | (() => Uint8Array)): Authenticator;
