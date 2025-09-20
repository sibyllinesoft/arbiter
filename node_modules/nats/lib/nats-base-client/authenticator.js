"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiAuthenticator = multiAuthenticator;
exports.noAuthFn = noAuthFn;
exports.usernamePasswordAuthenticator = usernamePasswordAuthenticator;
exports.tokenAuthenticator = tokenAuthenticator;
exports.nkeyAuthenticator = nkeyAuthenticator;
exports.jwtAuthenticator = jwtAuthenticator;
exports.credsAuthenticator = credsAuthenticator;
/*
 * Copyright 2020-2023 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const nkeys_1 = require("./nkeys");
const encoders_1 = require("./encoders");
const core_1 = require("./core");
function multiAuthenticator(authenticators) {
    return (nonce) => {
        let auth = {};
        authenticators.forEach((a) => {
            const args = a(nonce) || {};
            auth = Object.assign(auth, args);
        });
        return auth;
    };
}
function noAuthFn() {
    return () => {
        return;
    };
}
/**
 * Returns a user/pass authenticator for the specified user and optional password
 * @param { string | () => string } user
 * @param {string | () => string } pass
 * @return {UserPass}
 */
function usernamePasswordAuthenticator(user, pass) {
    return () => {
        const u = typeof user === "function" ? user() : user;
        const p = typeof pass === "function" ? pass() : pass;
        return { user: u, pass: p };
    };
}
/**
 * Returns a token authenticator for the specified token
 * @param { string | () => string } token
 * @return {TokenAuth}
 */
function tokenAuthenticator(token) {
    return () => {
        const auth_token = typeof token === "function" ? token() : token;
        return { auth_token };
    };
}
/**
 * Returns an Authenticator that returns a NKeyAuth based that uses the
 * specified seed or function returning a seed.
 * @param {Uint8Array | (() => Uint8Array)} seed - the nkey seed
 * @return {NKeyAuth}
 */
function nkeyAuthenticator(seed) {
    return (nonce) => {
        const s = typeof seed === "function" ? seed() : seed;
        const kp = s ? nkeys_1.nkeys.fromSeed(s) : undefined;
        const nkey = kp ? kp.getPublicKey() : "";
        const challenge = encoders_1.TE.encode(nonce || "");
        const sigBytes = kp !== undefined && nonce ? kp.sign(challenge) : undefined;
        const sig = sigBytes ? nkeys_1.nkeys.encode(sigBytes) : "";
        return { nkey, sig };
    };
}
/**
 * Returns an Authenticator function that returns a JwtAuth.
 * If a seed is provided, the public key, and signature are
 * calculated.
 *
 * @param {string | ()=>string} ajwt - the jwt
 * @param {Uint8Array | ()=> Uint8Array } seed - the optional nkey seed
 * @return {Authenticator}
 */
function jwtAuthenticator(ajwt, seed) {
    return (nonce) => {
        const jwt = typeof ajwt === "function" ? ajwt() : ajwt;
        const fn = nkeyAuthenticator(seed);
        const { nkey, sig } = fn(nonce);
        return { jwt, nkey, sig };
    };
}
/**
 * Returns an Authenticator function that returns a JwtAuth.
 * This is a convenience Authenticator that parses the
 * specified creds and delegates to the jwtAuthenticator.
 * @param {Uint8Array | () => Uint8Array } creds - the contents of a creds file or a function that returns the creds
 * @returns {JwtAuth}
 */
function credsAuthenticator(creds) {
    const fn = typeof creds !== "function" ? () => creds : creds;
    const parse = () => {
        const CREDS = /\s*(?:(?:[-]{3,}[^\n]*[-]{3,}\n)(.+)(?:\n\s*[-]{3,}[^\n]*[-]{3,}\n))/ig;
        const s = encoders_1.TD.decode(fn());
        // get the JWT
        let m = CREDS.exec(s);
        if (!m) {
            throw core_1.NatsError.errorForCode(core_1.ErrorCode.BadCreds);
        }
        const jwt = m[1].trim();
        // get the nkey
        m = CREDS.exec(s);
        if (!m) {
            throw core_1.NatsError.errorForCode(core_1.ErrorCode.BadCreds);
        }
        if (!m) {
            throw core_1.NatsError.errorForCode(core_1.ErrorCode.BadCreds);
        }
        const seed = encoders_1.TE.encode(m[1].trim());
        return { jwt, seed };
    };
    const jwtFn = () => {
        const { jwt } = parse();
        return jwt;
    };
    const nkeyFn = () => {
        const { seed } = parse();
        return seed;
    };
    return jwtAuthenticator(jwtFn, nkeyFn);
}
//# sourceMappingURL=authenticator.js.map