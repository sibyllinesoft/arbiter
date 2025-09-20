import { Deferred } from "./util";
import { Endpoint, EndpointInfo, EndpointOptions, Msg, MsgHdrs, NamedEndpointStats, Nanos, NatsConnection, NatsError, Payload, PublishOptions, QueuedIterator, ReviverFn, Service, ServiceConfig, ServiceGroup, ServiceHandler, ServiceIdentity, ServiceInfo, ServiceMsg, ServiceStats, ServiceVerb, Sub } from "./core";
/**
 * Services have common backplane subject pattern:
 *
 * `$SRV.PING|STATS|INFO` - pings or retrieves status for all services
 * `$SRV.PING|STATS|INFO.<name>` - pings or retrieves status for all services having the specified name
 * `$SRV.PING|STATS|INFO.<name>.<id>` - pings or retrieves status of a particular service
 *
 * Note that <name> and <id> are upper-cased.
 */
export declare const ServiceApiPrefix = "$SRV";
export declare class ServiceMsgImpl implements ServiceMsg {
    msg: Msg;
    constructor(msg: Msg);
    get data(): Uint8Array;
    get sid(): number;
    get subject(): string;
    get reply(): string;
    get headers(): MsgHdrs | undefined;
    respond(data?: Payload, opts?: PublishOptions): boolean;
    respondError(code: number, description: string, data?: Uint8Array, opts?: PublishOptions): boolean;
    json<T = unknown>(reviver?: ReviverFn): T;
    string(): string;
}
export declare class ServiceGroupImpl implements ServiceGroup {
    subject: string;
    queue: string;
    srv: ServiceImpl;
    constructor(parent: ServiceGroup, name?: string, queue?: string);
    calcSubject(root: string, name?: string): string;
    addEndpoint(name?: string, opts?: ServiceHandler | EndpointOptions): QueuedIterator<ServiceMsg>;
    addGroup(name?: string, queue?: string): ServiceGroup;
}
type NamedEndpoint = {
    name: string;
} & Endpoint;
type ServiceSubscription<T = unknown> = NamedEndpoint & {
    internal: boolean;
    sub: Sub<T>;
    qi?: QueuedIterator<T>;
    stats: NamedEndpointStatsImpl;
    metadata?: Record<string, string>;
};
export declare class ServiceImpl implements Service {
    nc: NatsConnection;
    _id: string;
    config: ServiceConfig;
    handlers: ServiceSubscription[];
    internal: ServiceSubscription[];
    _stopped: boolean;
    _done: Deferred<Error | null>;
    started: string;
    /**
     * @param verb
     * @param name
     * @param id
     * @param prefix - this is only supplied by tooling when building control subject that crosses an account
     */
    static controlSubject(verb: ServiceVerb, name?: string, id?: string, prefix?: string): string;
    constructor(nc: NatsConnection, config?: ServiceConfig);
    get subjects(): string[];
    get id(): string;
    get name(): string;
    get description(): string;
    get version(): string;
    get metadata(): Record<string, string> | undefined;
    errorToHeader(err: Error): MsgHdrs;
    setupHandler(h: NamedEndpoint, internal?: boolean): ServiceSubscription;
    info(): ServiceInfo;
    endpoints(): EndpointInfo[];
    stats(): Promise<ServiceStats>;
    addInternalHandler(verb: ServiceVerb, handler: (err: NatsError | null, msg: Msg) => Promise<void>): void;
    _doAddInternalHandler(name: string, verb: ServiceVerb, handler: (err: NatsError | null, msg: Msg) => Promise<void>, kind?: string, id?: string): void;
    start(): Promise<Service>;
    close(err?: Error): Promise<null | Error>;
    get stopped(): Promise<null | Error>;
    get isStopped(): boolean;
    stop(err?: Error): Promise<null | Error>;
    ping(): ServiceIdentity;
    reset(): void;
    addGroup(name: string, queue?: string): ServiceGroup;
    addEndpoint(name: string, handler?: ServiceHandler | EndpointOptions): QueuedIterator<ServiceMsg>;
    _addEndpoint(e: NamedEndpoint): QueuedIterator<ServiceMsg>;
}
declare class NamedEndpointStatsImpl implements NamedEndpointStats {
    name: string;
    subject: string;
    average_processing_time: Nanos;
    num_requests: number;
    processing_time: Nanos;
    num_errors: number;
    last_error?: string;
    data?: unknown;
    metadata?: Record<string, string>;
    queue: string;
    constructor(name: string, subject: string, queue?: string);
    reset(qi?: QueuedIterator<unknown>): void;
    countLatency(start: number): void;
    countError(err: Error): void;
    _stats(): NamedEndpointStats;
    stats(qi?: QueuedIterator<unknown>): NamedEndpointStats;
}
export {};
