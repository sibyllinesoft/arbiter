/**
 * @ignore
 */
export declare function createPair(prefix: Prefix): KeyPair;
/**
 * Creates a KeyPair with an operator prefix
 * @returns {KeyPair} Returns the created KeyPair.
 */
export declare function createOperator(): KeyPair;
/**
 * Creates a KeyPair with an account prefix
 * @returns {KeyPair} Returns the created KeyPair.
 */
export declare function createAccount(): KeyPair;
/**
 * Creates a KeyPair with a user prefix
 * @returns {KeyPair} Returns the created KeyPair.
 */
export declare function createUser(): KeyPair;
/**
 * @ignore
 */
export declare function createCluster(): KeyPair;
/**
 * @ignore
 */
export declare function createServer(): KeyPair;
/**
 * @ignore
 */
export declare function createCurve(): KeyPair;
/**
 * Creates a KeyPair from a specified public key
 * @param {string} src of the public key in string format.
 * @returns {KeyPair} Returns the created KeyPair.
 * @see KeyPair#getPublicKey
 */
export declare function fromPublic(src: string): KeyPair;
export declare function fromCurveSeed(src: Uint8Array): KeyPair;
/**
 * Creates a KeyPair from a specified seed.
 * @param {Uint8Array} src of the seed key as Uint8Array
 * @returns {KeyPair} Returns the created KeyPair.
 * @see KeyPair#getSeed
 */
export declare function fromSeed(src: Uint8Array): KeyPair;
export interface KeyPair {
    /**
     * Returns the public key associated with the KeyPair
     * @returns {string}
     * @throws NKeysError
     */
    getPublicKey(): string;
    /**
     * Returns the private key associated with the KeyPair
     * @returns Uint8Array
     * @throws NKeysError
     */
    getPrivateKey(): Uint8Array;
    /**
     * Returns the PrivateKey's seed.
     * @returns Uint8Array
     * @throws NKeysError
     */
    getSeed(): Uint8Array;
    /**
     * Returns the digital signature of signing the input with the
     * the KeyPair's private key.
     * @param {Uint8Array} input
     * @returns Uint8Array
     * @throws NKeysError
     */
    sign(input: Uint8Array): Uint8Array;
    /**
     * Returns true if the signature can be verified with the KeyPair
     * @param {Uint8Array} input
     * @param {Uint8Array} sig
     * @returns {boolean}
     * @throws NKeysError
     */
    verify(input: Uint8Array, sig: Uint8Array): boolean;
    /**
     * Clears the secret stored in the keypair. After clearing
     * a keypair cannot be used or recovered.
     */
    clear(): void;
    seal(input: Uint8Array, recipient: string, nonce?: Uint8Array): Uint8Array;
    open(message: Uint8Array, sender: string): Uint8Array | null;
}
/**
 * @ignore
 */
export declare enum Prefix {
    Unknown = -1,
    Seed = 144,// Base32-encodes to 'S...'
    Private = 120,// Base32-encodes to 'P...'
    Operator = 112,// Base32-encodes to 'O...'
    Server = 104,// Base32-encodes to 'N...'
    Cluster = 16,// Base32-encodes to 'C...'
    Account = 0,// Base32-encodes to 'A...'
    User = 160,// Base32-encodes to 'U...'
    Curve = 184
}
/**
 * @private
 */
export declare class Prefixes {
    static isValidPublicPrefix(prefix: Prefix): boolean;
    static startsWithValidPrefix(s: string): boolean;
    static isValidPrefix(prefix: Prefix): boolean;
    static parsePrefix(v: number): Prefix;
}
/**
 * Possible error codes on exceptions thrown by the library.
 */
export declare enum NKeysErrorCode {
    InvalidPrefixByte = "nkeys: invalid prefix byte",
    InvalidKey = "nkeys: invalid key",
    InvalidPublicKey = "nkeys: invalid public key",
    InvalidSeedLen = "nkeys: invalid seed length",
    InvalidSeed = "nkeys: invalid seed",
    InvalidCurveSeed = "nkeys: invalid curve seed",
    InvalidCurveKey = "nkeys: not a valid curve key",
    InvalidCurveOperation = "nkeys: curve key is not valid for sign/verify",
    InvalidNKeyOperation = "keys: only curve key can seal/open",
    InvalidEncoding = "nkeys: invalid encoded key",
    InvalidRecipient = "nkeys: not a valid recipient public curve key",
    InvalidEncrypted = "nkeys: encrypted input is not valid",
    CannotSign = "nkeys: cannot sign, no private key available",
    PublicKeyOnly = "nkeys: no seed or private key available",
    InvalidChecksum = "nkeys: invalid checksum",
    SerializationError = "nkeys: serialization error",
    ApiError = "nkeys: api error",
    ClearedPair = "nkeys: pair is cleared"
}
export declare class NKeysError extends Error {
    name: string;
    code: string;
    chainedError?: Error;
    /**
     * @param {NKeysErrorCode} code
     * @param {Error} [chainedError]
     * @constructor
     *
     * @api private
     */
    constructor(code: NKeysErrorCode, chainedError?: Error);
}
