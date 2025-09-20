import { KeyPair } from "./nkeys";
/**
 * @ignore
 */
export declare class PublicKey implements KeyPair {
    publicKey?: Uint8Array;
    constructor(publicKey: Uint8Array);
    getPublicKey(): string;
    getPrivateKey(): Uint8Array;
    getSeed(): Uint8Array;
    sign(_: Uint8Array): Uint8Array;
    verify(input: Uint8Array, sig: Uint8Array): boolean;
    clear(): void;
    seal(input: Uint8Array, recipient: string, nonce?: Uint8Array): Uint8Array;
    open(message: Uint8Array, sender: string): Uint8Array | null;
}
