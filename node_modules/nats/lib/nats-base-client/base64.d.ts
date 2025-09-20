export declare class Base64Codec {
    static encode(bytes: string | Uint8Array): string;
    static decode(s: string, binary?: boolean): Uint8Array | string;
}
export declare class Base64UrlCodec {
    static encode(bytes: string | Uint8Array): string;
    static decode(s: string, binary?: boolean): Uint8Array | string;
    static toB64URLEncoding(b64str: string): string;
    static fromB64URLEncoding(b64str: string): string;
}
export declare class Base64UrlPaddedCodec {
    static encode(bytes: string | Uint8Array): string;
    static decode(s: string, binary?: boolean): Uint8Array | string;
    static toB64URLEncoding(b64str: string): string;
    static fromB64URLEncoding(b64str: string): string;
}
