/**
 * @ignore
 */
interface SignPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
/**
 * @ignore
 */
export interface Ed25519Helper {
    fromSeed(seed: Uint8Array): SignPair;
    sign(data: Uint8Array, key: Uint8Array): Uint8Array;
    verify(data: Uint8Array, sig: Uint8Array, pub: Uint8Array): boolean;
    randomBytes(len: number): Uint8Array;
    scalarBaseMultiply(n: Uint8Array): Uint8Array;
    seal(data: Uint8Array, nonce: Uint8Array, pub: Uint8Array, key: Uint8Array): Uint8Array;
    open(data: Uint8Array, nonce: Uint8Array, pub: Uint8Array, key: Uint8Array): Uint8Array;
}
/**
 * @ignore
 */
export declare function setEd25519Helper(lib: Ed25519Helper): void;
/**
 * @ignore
 */
export declare function getEd25519Helper(): Ed25519Helper;
export {};
