"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NKeysError = exports.NKeysErrorCode = exports.Prefixes = exports.Prefix = exports.fromSeed = exports.fromCurveSeed = exports.fromPublic = exports.createCurve = exports.createServer = exports.createCluster = exports.createUser = exports.createAccount = exports.createOperator = exports.createPair = void 0;
/*
 * Copyright 2018-2024 The NATS Authors
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
const kp_1 = require("./kp");
const public_1 = require("./public");
const codec_1 = require("./codec");
const helper_1 = require("./helper");
const curve_1 = require("./curve");
/**
 * @ignore
 */
function createPair(prefix) {
    const len = prefix === Prefix.Curve ? curve_1.curveKeyLen : 32;
    const rawSeed = (0, helper_1.getEd25519Helper)().randomBytes(len);
    let str = codec_1.Codec.encodeSeed(prefix, new Uint8Array(rawSeed));
    return prefix === Prefix.Curve
        ? new curve_1.CurveKP(new Uint8Array(rawSeed))
        : new kp_1.KP(str);
}
exports.createPair = createPair;
/**
 * Creates a KeyPair with an operator prefix
 * @returns {KeyPair} Returns the created KeyPair.
 */
function createOperator() {
    return createPair(Prefix.Operator);
}
exports.createOperator = createOperator;
/**
 * Creates a KeyPair with an account prefix
 * @returns {KeyPair} Returns the created KeyPair.
 */
function createAccount() {
    return createPair(Prefix.Account);
}
exports.createAccount = createAccount;
/**
 * Creates a KeyPair with a user prefix
 * @returns {KeyPair} Returns the created KeyPair.
 */
function createUser() {
    return createPair(Prefix.User);
}
exports.createUser = createUser;
/**
 * @ignore
 */
function createCluster() {
    return createPair(Prefix.Cluster);
}
exports.createCluster = createCluster;
/**
 * @ignore
 */
function createServer() {
    return createPair(Prefix.Server);
}
exports.createServer = createServer;
/**
 * @ignore
 */
function createCurve() {
    return createPair(Prefix.Curve);
}
exports.createCurve = createCurve;
/**
 * Creates a KeyPair from a specified public key
 * @param {string} src of the public key in string format.
 * @returns {KeyPair} Returns the created KeyPair.
 * @see KeyPair#getPublicKey
 */
function fromPublic(src) {
    const ba = new TextEncoder().encode(src);
    const raw = codec_1.Codec._decode(ba);
    const prefix = Prefixes.parsePrefix(raw[0]);
    if (Prefixes.isValidPublicPrefix(prefix)) {
        return new public_1.PublicKey(ba);
    }
    throw new NKeysError(NKeysErrorCode.InvalidPublicKey);
}
exports.fromPublic = fromPublic;
function fromCurveSeed(src) {
    const sd = codec_1.Codec.decodeSeed(src);
    if (sd.prefix !== Prefix.Curve) {
        throw new NKeysError(NKeysErrorCode.InvalidCurveSeed);
    }
    if (sd.buf.byteLength !== curve_1.curveKeyLen) {
        throw new NKeysError(NKeysErrorCode.InvalidSeedLen);
    }
    return new curve_1.CurveKP(sd.buf);
}
exports.fromCurveSeed = fromCurveSeed;
/**
 * Creates a KeyPair from a specified seed.
 * @param {Uint8Array} src of the seed key as Uint8Array
 * @returns {KeyPair} Returns the created KeyPair.
 * @see KeyPair#getSeed
 */
function fromSeed(src) {
    const sd = codec_1.Codec.decodeSeed(src);
    // if we are here it decoded properly
    if (sd.prefix === Prefix.Curve) {
        return fromCurveSeed(src);
    }
    return new kp_1.KP(src);
}
exports.fromSeed = fromSeed;
/**
 * @ignore
 */
var Prefix;
(function (Prefix) {
    Prefix[Prefix["Unknown"] = -1] = "Unknown";
    //Seed is the version byte used for encoded NATS Seeds
    Prefix[Prefix["Seed"] = 144] = "Seed";
    //PrefixBytePrivate is the version byte used for encoded NATS Private keys
    Prefix[Prefix["Private"] = 120] = "Private";
    //PrefixByteOperator is the version byte used for encoded NATS Operators
    Prefix[Prefix["Operator"] = 112] = "Operator";
    //PrefixByteServer is the version byte used for encoded NATS Servers
    Prefix[Prefix["Server"] = 104] = "Server";
    //PrefixByteCluster is the version byte used for encoded NATS Clusters
    Prefix[Prefix["Cluster"] = 16] = "Cluster";
    //PrefixByteAccount is the version byte used for encoded NATS Accounts
    Prefix[Prefix["Account"] = 0] = "Account";
    //PrefixByteUser is the version byte used for encoded NATS Users
    Prefix[Prefix["User"] = 160] = "User";
    Prefix[Prefix["Curve"] = 184] = "Curve";
})(Prefix || (exports.Prefix = Prefix = {}));
/**
 * @private
 */
class Prefixes {
    static isValidPublicPrefix(prefix) {
        return prefix == Prefix.Server ||
            prefix == Prefix.Operator ||
            prefix == Prefix.Cluster ||
            prefix == Prefix.Account ||
            prefix == Prefix.User ||
            prefix == Prefix.Curve;
    }
    static startsWithValidPrefix(s) {
        let c = s[0];
        return c == "S" || c == "P" || c == "O" || c == "N" || c == "C" ||
            c == "A" || c == "U" || c == "X";
    }
    static isValidPrefix(prefix) {
        let v = this.parsePrefix(prefix);
        return v !== Prefix.Unknown;
    }
    static parsePrefix(v) {
        switch (v) {
            case Prefix.Seed:
                return Prefix.Seed;
            case Prefix.Private:
                return Prefix.Private;
            case Prefix.Operator:
                return Prefix.Operator;
            case Prefix.Server:
                return Prefix.Server;
            case Prefix.Cluster:
                return Prefix.Cluster;
            case Prefix.Account:
                return Prefix.Account;
            case Prefix.User:
                return Prefix.User;
            case Prefix.Curve:
                return Prefix.Curve;
            default:
                return Prefix.Unknown;
        }
    }
}
exports.Prefixes = Prefixes;
/**
 * Possible error codes on exceptions thrown by the library.
 */
var NKeysErrorCode;
(function (NKeysErrorCode) {
    NKeysErrorCode["InvalidPrefixByte"] = "nkeys: invalid prefix byte";
    NKeysErrorCode["InvalidKey"] = "nkeys: invalid key";
    NKeysErrorCode["InvalidPublicKey"] = "nkeys: invalid public key";
    NKeysErrorCode["InvalidSeedLen"] = "nkeys: invalid seed length";
    NKeysErrorCode["InvalidSeed"] = "nkeys: invalid seed";
    NKeysErrorCode["InvalidCurveSeed"] = "nkeys: invalid curve seed";
    NKeysErrorCode["InvalidCurveKey"] = "nkeys: not a valid curve key";
    NKeysErrorCode["InvalidCurveOperation"] = "nkeys: curve key is not valid for sign/verify";
    NKeysErrorCode["InvalidNKeyOperation"] = "keys: only curve key can seal/open";
    NKeysErrorCode["InvalidEncoding"] = "nkeys: invalid encoded key";
    NKeysErrorCode["InvalidRecipient"] = "nkeys: not a valid recipient public curve key";
    NKeysErrorCode["InvalidEncrypted"] = "nkeys: encrypted input is not valid";
    NKeysErrorCode["CannotSign"] = "nkeys: cannot sign, no private key available";
    NKeysErrorCode["PublicKeyOnly"] = "nkeys: no seed or private key available";
    NKeysErrorCode["InvalidChecksum"] = "nkeys: invalid checksum";
    NKeysErrorCode["SerializationError"] = "nkeys: serialization error";
    NKeysErrorCode["ApiError"] = "nkeys: api error";
    NKeysErrorCode["ClearedPair"] = "nkeys: pair is cleared";
})(NKeysErrorCode || (exports.NKeysErrorCode = NKeysErrorCode = {}));
class NKeysError extends Error {
    /**
     * @param {NKeysErrorCode} code
     * @param {Error} [chainedError]
     * @constructor
     *
     * @api private
     */
    constructor(code, chainedError) {
        super(code);
        this.name = "NKeysError";
        this.code = code;
        this.chainedError = chainedError;
    }
}
exports.NKeysError = NKeysError;
