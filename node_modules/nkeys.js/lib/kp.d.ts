import { KeyPair } from "./nkeys";
/**
 * @ignore
 */
export declare class KP implements KeyPair {
    seed?: Uint8Array;
    constructor(seed: Uint8Array);
    getRawSeed(): Uint8Array;
    getSeed(): Uint8Array;
    getPublicKey(): string;
    getPrivateKey(): Uint8Array;
    sign(input: Uint8Array): Uint8Array;
    verify(input: Uint8Array, sig: Uint8Array): boolean;
    clear(): void;
    seal(input: Uint8Array, recipient: string, nonce?: Uint8Array): Uint8Array;
    open(message: Uint8Array, sender: string): Uint8Array | null;
}
