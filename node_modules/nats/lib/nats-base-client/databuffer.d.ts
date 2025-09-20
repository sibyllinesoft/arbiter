export declare class DataBuffer {
    buffers: Uint8Array[];
    byteLength: number;
    constructor();
    static concat(...bufs: Uint8Array[]): Uint8Array;
    static fromAscii(m: string): Uint8Array;
    static toAscii(a: Uint8Array): string;
    reset(): void;
    pack(): void;
    shift(): Uint8Array;
    drain(n?: number): Uint8Array;
    fill(a: Uint8Array, ...bufs: Uint8Array[]): void;
    peek(): Uint8Array;
    size(): number;
    length(): number;
}
