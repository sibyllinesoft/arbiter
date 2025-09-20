import { KeyPair } from "./nkeys";
export declare const curveKeyLen = 32;
export declare const curveNonceLen = 24;
export declare class CurveKP implements KeyPair {
    seed?: Uint8Array;
    constructor(seed: Uint8Array);
    clear(): void;
    getPrivateKey(): Uint8Array;
    getPublicKey(): string;
    getSeed(): Uint8Array;
    sign(): Uint8Array;
    verify(): boolean;
    decodePubCurveKey(src: string): Uint8Array;
    seal(message: Uint8Array, recipient: string, nonce?: Uint8Array): Uint8Array;
    open(message: Uint8Array, sender: string): Uint8Array | null;
}
