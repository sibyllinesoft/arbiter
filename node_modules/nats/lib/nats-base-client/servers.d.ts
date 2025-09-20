import { DnsResolveFn, Server, ServerInfo, ServersChanged } from "./core";
export declare function isIPV4OrHostname(hp: string): boolean;
export declare function hostPort(u: string): {
    listen: string;
    hostname: string;
    port: number;
};
/**
 * @hidden
 */
export declare class ServerImpl implements Server {
    src: string;
    listen: string;
    hostname: string;
    port: number;
    didConnect: boolean;
    reconnects: number;
    lastConnect: number;
    gossiped: boolean;
    tlsName: string;
    resolves?: Server[];
    constructor(u: string, gossiped?: boolean);
    toString(): string;
    resolve(opts: Partial<{
        fn: DnsResolveFn;
        randomize: boolean;
        resolve: boolean;
        debug: boolean;
    }>): Promise<Server[]>;
}
/**
 * @hidden
 */
export declare class Servers {
    private firstSelect;
    private readonly servers;
    private currentServer;
    private tlsName;
    private randomize;
    constructor(listens?: string[], opts?: Partial<{
        randomize: boolean;
    }>);
    clear(): void;
    updateTLSName(): void;
    getCurrentServer(): ServerImpl;
    addServer(u: string, implicit?: boolean): void;
    selectServer(): ServerImpl | undefined;
    removeCurrentServer(): void;
    removeServer(server: ServerImpl | undefined): void;
    length(): number;
    next(): ServerImpl | undefined;
    getServers(): ServerImpl[];
    update(info: ServerInfo, encrypted?: boolean): ServersChanged;
}
