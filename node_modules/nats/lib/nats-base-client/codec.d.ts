export interface Codec<T> {
    /**
     * Encode T to an Uint8Array suitable for including in a message payload.
     * @param d
     */
    encode(d: T): Uint8Array;
    /**
     * Decode an Uint8Array from a message payload into a T
     * @param a
     */
    decode(a: Uint8Array): T;
}
/**
 * Returns a {@link Codec} for encoding strings to a message payload
 * and decoding message payloads into strings.
 * @constructor
 */
export declare function StringCodec(): Codec<string>;
/**
 * Returns a {@link Codec}  for encoding JavaScript object to JSON and
 * serialize them to an Uint8Array, and conversely, from an
 * Uint8Array to JSON to a JavaScript Object.
 * @param reviver
 * @constructor
 */
export declare function JSONCodec<T = unknown>(reviver?: (this: unknown, key: string, value: unknown) => unknown): Codec<T>;
