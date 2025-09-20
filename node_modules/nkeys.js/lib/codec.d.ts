import { Prefix } from "./nkeys";
/**
 * @ignore
 */
export interface SeedDecode {
    prefix: Prefix;
    buf: Uint8Array;
}
/**
 * @ignore
 */
export declare class Codec {
    static encode(prefix: Prefix, src: Uint8Array): Uint8Array;
    static encodeSeed(role: Prefix, src: Uint8Array): Uint8Array;
    static decode(expected: Prefix, src: Uint8Array): Uint8Array;
    static decodeSeed(src: Uint8Array): SeedDecode;
    static _encode(seed: boolean, role: Prefix, payload: Uint8Array): Uint8Array;
    static _decode(src: Uint8Array): Uint8Array;
    static _encodePrefix(kind: Prefix, role: Prefix): Uint8Array;
    static _decodePrefix(raw: Uint8Array): Uint8Array;
}
