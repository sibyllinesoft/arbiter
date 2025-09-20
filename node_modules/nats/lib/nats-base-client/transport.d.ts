import { ConnectionOptions, DnsResolveFn, Server, URLParseFn } from "./core";
export declare function setTransportFactory(config: TransportFactory): void;
export declare function defaultPort(): number;
export declare function getUrlParseFn(): URLParseFn | undefined;
export declare function newTransport(): Transport;
export declare function getResolveFn(): DnsResolveFn | undefined;
export interface TransportFactory {
    factory?: () => Transport;
    defaultPort?: number;
    urlParseFn?: URLParseFn;
    dnsResolveFn?: DnsResolveFn;
}
export interface Transport extends AsyncIterable<Uint8Array> {
    readonly isClosed: boolean;
    readonly lang: string;
    readonly version: string;
    readonly closeError?: Error;
    connect(server: Server, opts: ConnectionOptions): Promise<void>;
    [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
    isEncrypted(): boolean;
    send(frame: Uint8Array): void;
    close(err?: Error): Promise<void>;
    disconnect(): void;
    closed(): Promise<void | Error>;
    discard(): void;
}
export declare const CR_LF = "\r\n";
export declare const CR_LF_LEN: number;
export declare const CRLF: Uint8Array<ArrayBufferLike>;
export declare const CR: number;
export declare const LF: number;
export declare function protoLen(ba: Uint8Array): number;
export declare function extractProtocolMessage(a: Uint8Array): string;
