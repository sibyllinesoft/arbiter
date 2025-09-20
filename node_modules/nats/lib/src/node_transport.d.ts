import { Deferred, ServerInfo, Transport } from "./nats-base-client";
import type { ConnectionOptions } from "./nats-base-client";
import { Socket } from "net";
import { TlsOptions, TLSSocket } from "tls";
export declare class NodeTransport implements Transport {
    socket: Socket;
    version: string;
    lang: string;
    yields: Uint8Array[];
    signal: Deferred<void>;
    closedNotification: Deferred<void | Error>;
    options: ConnectionOptions;
    connected: boolean;
    tlsName: string;
    done: boolean;
    closeError?: Error;
    constructor();
    connect(hp: {
        hostname: string;
        port: number;
        tlsName: string;
    }, options: ConnectionOptions): Promise<void>;
    dial(hp: {
        hostname: string;
        port: number;
    }): Promise<Socket>;
    get isClosed(): boolean;
    close(err?: Error): Promise<void>;
    peekInfo(): Promise<ServerInfo>;
    loadFile(fn: string): Promise<Buffer | void>;
    loadClientCerts(): Promise<TlsOptions | void>;
    tlsFirst(hp: {
        hostname: string;
        port: number;
    }): Promise<TLSSocket>;
    startTLS(): Promise<TLSSocket>;
    setupHandlers(): void;
    [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
    iterate(): AsyncIterableIterator<Uint8Array>;
    discard(): void;
    disconnect(): void;
    isEncrypted(): boolean;
    _send(frame: Uint8Array): Promise<void>;
    send(frame: Uint8Array): void;
    private _closed;
    closed(): Promise<void | Error>;
}
export declare function nodeResolveHost(s: string): Promise<string[]>;
