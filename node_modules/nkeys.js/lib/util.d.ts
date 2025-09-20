/**
 * Encode binary data to a base64 string
 * @param {Uint8Array} bytes to encode to base64
 */
export declare function encode(bytes: Uint8Array): string;
/**
 * Decode a base64 encoded string to a binary Uint8Array
 * @param {string} b64str encoded string
 */
export declare function decode(b64str: string): Uint8Array;
/**
 * @ignore
 */
export declare function dump(buf: Uint8Array, msg?: string): void;
