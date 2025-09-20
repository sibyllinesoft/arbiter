import { ProtocolHandler } from "./protocol";
import { ServiceClient } from "./types";
import type { SemVer } from "./semver";
import { Features } from "./semver";
import { JetStreamClient, JetStreamManager } from "../jetstream/types";
import { ConnectionOptions, Context, JetStreamManagerOptions, JetStreamOptions, Msg, NatsConnection, Payload, PublishOptions, QueuedIterator, RequestManyOptions, RequestOptions, ServerInfo, Service, ServiceConfig, ServicesAPI, Stats, Status, Subscription, SubscriptionOptions } from "./core";
export declare class NatsConnectionImpl implements NatsConnection {
    options: ConnectionOptions;
    protocol: ProtocolHandler;
    draining: boolean;
    listeners: QueuedIterator<Status>[];
    _services: ServicesAPI;
    private constructor();
    static connect(opts?: ConnectionOptions): Promise<NatsConnection>;
    closed(): Promise<void | Error>;
    close(): Promise<void>;
    _check(subject: string, sub: boolean, pub: boolean): void;
    publish(subject: string, data?: Payload, options?: PublishOptions): void;
    publishMessage(msg: Msg): void;
    respondMessage(msg: Msg): boolean;
    subscribe(subject: string, opts?: SubscriptionOptions): Subscription;
    _resub(s: Subscription, subject: string, max?: number): void;
    requestMany(subject: string, data?: Payload, opts?: Partial<RequestManyOptions>): Promise<QueuedIterator<Msg>>;
    request(subject: string, data?: Payload, opts?: RequestOptions): Promise<Msg>;
    /** *
     * Flushes to the server. Promise resolves when round-trip completes.
     * @returns {Promise<void>}
     */
    flush(): Promise<void>;
    drain(): Promise<void>;
    isClosed(): boolean;
    isDraining(): boolean;
    getServer(): string;
    status(): AsyncIterable<Status>;
    get info(): ServerInfo | undefined;
    context(): Promise<Context>;
    stats(): Stats;
    jetstreamManager(opts?: JetStreamManagerOptions): Promise<JetStreamManager>;
    jetstream(opts?: JetStreamOptions | JetStreamManagerOptions): JetStreamClient;
    getServerVersion(): SemVer | undefined;
    rtt(): Promise<number>;
    get features(): Features;
    get services(): ServicesAPI;
    reconnect(): Promise<void>;
}
export declare class ServicesFactory implements ServicesAPI {
    nc: NatsConnection;
    constructor(nc: NatsConnection);
    add(config: ServiceConfig): Promise<Service>;
    client(opts?: RequestManyOptions, prefix?: string): ServiceClient;
}
