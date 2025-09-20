export declare class AssertionError extends Error {
    constructor(msg?: string);
}
export interface Reader {
    read(p: Uint8Array): number | null;
}
export interface Writer {
    write(p: Uint8Array): number;
}
export declare function assert(cond: unknown, msg?: string): asserts cond;
export declare const MAX_SIZE: number;
export declare function concat(origin?: Uint8Array, b?: Uint8Array): Uint8Array;
export declare function append(origin: Uint8Array, b: number): Uint8Array;
export declare class DenoBuffer implements Reader, Writer {
    _buf: Uint8Array;
    _off: number;
    constructor(ab?: ArrayBuffer);
    bytes(options?: {
        copy?: boolean;
    }): Uint8Array;
    empty(): boolean;
    get length(): number;
    get capacity(): number;
    truncate(n: number): void;
    reset(): void;
    _tryGrowByReslice(n: number): number;
    _reslice(len: number): void;
    readByte(): number | null;
    read(p: Uint8Array): number | null;
    writeByte(n: number): number;
    writeString(s: string): number;
    write(p: Uint8Array): number;
    _grow(n: number): number;
    grow(n: number): void;
    readFrom(r: Reader): number;
}
export declare function readAll(r: Reader): Uint8Array;
export declare function writeAll(w: Writer, arr: Uint8Array): void;
