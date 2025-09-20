import { Timeout } from "../nats-base-client/util";
import { ConsumerAPI, ConsumerAPIImpl } from "./jsmconsumer_api";
import { QueuedIteratorImpl } from "../nats-base-client/queued_iterator";
import { MsgHdrs, QueuedIterator, Status, Subscription } from "../nats-base-client/core";
import { IdleHeartbeatMonitor } from "../nats-base-client/idleheartbeat_monitor";
import { JsMsg } from "./jsmsg";
import { ConsumerConfig, ConsumerInfo, DeliverPolicy, PullOptions, ReplayPolicy } from "./jsapi_types";
declare enum PullConsumerType {
    Unset = -1,
    Consume = 0,
    Fetch = 1
}
export type Ordered = {
    ordered: true;
};
export type NextOptions = Expires & Bind;
export type ConsumeBytes = MaxBytes & Partial<MaxMessages> & Partial<ThresholdBytes> & Expires & IdleHeartbeat & ConsumeCallback & AbortOnMissingResource & Bind;
export type ConsumeMessages = Partial<MaxMessages> & Partial<ThresholdMessages> & Expires & IdleHeartbeat & ConsumeCallback & AbortOnMissingResource & Bind;
export type ConsumeOptions = ConsumeBytes | ConsumeMessages;
/**
 * Options for fetching bytes
 */
export type FetchBytes = MaxBytes & Partial<MaxMessages> & Expires & IdleHeartbeat & Bind;
/**
 * Options for fetching messages
 */
export type FetchMessages = Partial<MaxMessages> & Expires & IdleHeartbeat & Bind;
export type FetchOptions = FetchBytes | FetchMessages;
export type PullConsumerOptions = FetchOptions | ConsumeOptions;
export type MaxMessages = {
    /**
     * Maximum number of messages to retrieve.
     * @default 100 messages
     */
    max_messages: number;
};
export type MaxBytes = {
    /**
     * Maximum number of bytes to retrieve - note request must fit the entire message
     * to be honored (this includes, subject, headers, etc). Partial messages are not
     * supported.
     */
    max_bytes: number;
};
export type ThresholdMessages = {
    /**
     * Threshold message count on which the client will auto-trigger additional requests
     * from the server. This is only applicable to `consume`.
     * @default  75% of {@link MaxMessages}.
     */
    threshold_messages: number;
};
export type ThresholdBytes = {
    /**
     * Threshold bytes on which the client wil auto-trigger additional message requests
     * from the server. This is only applicable to `consume`.
     * @default 75% of {@link MaxBytes}.
     */
    threshold_bytes: number;
};
export type Expires = {
    /**
     * Amount of milliseconds to wait for messages before issuing another request.
     * Note this value shouldn't be set by the user, as the default provides proper behavior.
     * A low value will stress the server.
     *
     * Minimum value is 1000 (1s).
     * @default 30_000 (30s)
     */
    expires?: number;
};
export type Bind = {
    /**
     * If set to true the client will not try to check on its consumer by issuing consumer info
     * requests. This means that the client may not report consumer not found, etc., and will simply
     * fail request for messages due to missed heartbeats. This option is exclusive of abort_on_missing_resource.
     *
     * This option is not valid on ordered consumers.
     */
    bind?: boolean;
};
export type AbortOnMissingResource = {
    /**
     * If true, consume will abort if the stream or consumer is not found. Default is to recover
     * once the stream/consumer is restored. This option is exclusive of bind.
     */
    abort_on_missing_resource?: boolean;
};
export type IdleHeartbeat = {
    /**
     * Number of milliseconds to wait for a server heartbeat when not actively receiving
     * messages. When two or more heartbeats are missed in a row, the consumer will emit
     * a notification. Note this value shouldn't be set by the user, as the default provides
     * the proper behavior. A low value will stress the server.
     */
    idle_heartbeat?: number;
};
export type ConsumerCallbackFn = (r: JsMsg) => void;
export type ConsumeCallback = {
    /**
     * Process messages using a callback instead of an iterator. Note that when using callbacks,
     * the callback cannot be async. If you must use async functionality, process messages
     * using an iterator.
     */
    callback?: ConsumerCallbackFn;
};
/**
 * ConsumerEvents are informational notifications emitted by ConsumerMessages
 * that may be of interest to a client.
 */
export declare enum ConsumerEvents {
    /**
     * Notification that heartbeats were missed. This notification is informational.
     * The `data` portion of the status, is a number indicating the number of missed heartbeats.
     * Note that when a client disconnects, heartbeat tracking is paused while
     * the client is disconnected.
     */
    HeartbeatsMissed = "heartbeats_missed",
    /**
     * Notification that the consumer was not found. Consumers that were accessible at
     * least once, will be retried for more messages regardless of the not being found
     * or timeouts etc. This notification includes a count of consecutive attempts to
     * find the consumer. Note that if you get this notification possibly your code should
     * attempt to recreate the consumer. Note that this notification is only informational
     * for ordered consumers, as the consumer will be created in those cases automatically.
     */
    ConsumerNotFound = "consumer_not_found",
    /**
     * Notification that the stream was not found. Consumers were accessible at least once,
     * will be retried for more messages regardless of the not being found
     * or timeouts etc. This notification includes a count of consecutive attempts to
     * find the consumer. Note that if you get this notification possibly your code should
     * attempt to recreate the consumer. Note that this notification is only informational
     * for ordered consumers, as the consumer will be created in those cases automatically.
     */
    StreamNotFound = "stream_not_found",
    ConsumerDeleted = "consumer_deleted",
    /**
     * This notification is specific of ordered consumers and will be notified whenever
     * the consumer is recreated. The argument is the name of the newly created consumer.
     */
    OrderedConsumerRecreated = "ordered_consumer_recreated",
    /**
     * This notification means that either both the stream and consumer were not
     * found or that JetStream is not available.
     */
    NoResponders = "no_responders"
}
/**
 * These events represent informational notifications emitted by ConsumerMessages
 * that can be safely ignored by clients.
 */
export declare enum ConsumerDebugEvents {
    /**
     * DebugEvents are effectively statuses returned by the server that were ignored
     * by the client. The `data` portion of the
     * status is just a string indicating the code/message of the status.
     */
    DebugEvent = "debug",
    /**
     * Requests for messages can be terminated by the server, these notifications
     * provide information on the number of messages and/or bytes that couldn't
     * be satisfied by the consumer request. The `data` portion of the status will
     * have the format of `{msgsLeft: number, bytesLeft: number}`.
     */
    Discard = "discard",
    /**
     * Notifies that the current consumer will be reset
     */
    Reset = "reset",
    /**
     * Notifies whenever there's a request for additional messages from the server.
     * This notification telegraphs the request options, which should be treated as
     * read-only. This notification is only useful for debugging. Data is PullOptions.
     */
    Next = "next"
}
export interface ConsumerStatus {
    type: ConsumerEvents | ConsumerDebugEvents;
    data: unknown;
}
export interface ExportedConsumer {
    next(opts?: NextOptions): Promise<JsMsg | null>;
    fetch(opts?: FetchOptions): Promise<ConsumerMessages>;
    consume(opts?: ConsumeOptions): Promise<ConsumerMessages>;
}
export interface Consumer extends ExportedConsumer {
    info(cached?: boolean): Promise<ConsumerInfo>;
    delete(): Promise<boolean>;
}
export interface Close {
    close(): Promise<void | Error>;
    closed(): Promise<void | Error>;
}
export interface ConsumerMessages extends QueuedIterator<JsMsg>, Close {
    status(): Promise<AsyncIterable<ConsumerStatus>>;
}
export declare class PullConsumerMessagesImpl extends QueuedIteratorImpl<JsMsg> implements ConsumerMessages {
    consumer: PullConsumerImpl;
    opts: Record<string, number>;
    sub: Subscription;
    monitor: IdleHeartbeatMonitor | null;
    pending: {
        msgs: number;
        bytes: number;
        requests: number;
    };
    inbox: string;
    refilling: boolean;
    pong: Promise<void> | null;
    callback: ConsumerCallbackFn | null;
    timeout: Timeout<unknown> | null;
    cleanupHandler?: (err: void | Error) => void;
    listeners: QueuedIterator<ConsumerStatus>[];
    statusIterator?: QueuedIteratorImpl<Status>;
    forOrderedConsumer: boolean;
    resetHandler?: () => void;
    abortOnMissingResource?: boolean;
    bind: boolean;
    inBackOff: boolean;
    constructor(c: PullConsumerImpl, opts: ConsumeOptions | FetchOptions, refilling?: boolean);
    start(): void;
    _push(r: JsMsg): void;
    notify(type: ConsumerEvents | ConsumerDebugEvents, data: unknown): void;
    resetPending(): Promise<boolean>;
    resetPendingNoInfo(): Promise<boolean>;
    resetPendingWithInfo(): Promise<boolean>;
    pull(opts: Partial<PullOptions>): void;
    pullOptions(): Partial<PullOptions>;
    parseDiscard(headers?: MsgHdrs): {
        msgsLeft: number;
        bytesLeft: number;
    };
    trackTimeout(t: Timeout<unknown>): void;
    close(): Promise<void | Error>;
    closed(): Promise<void | Error>;
    clearTimers(): void;
    setCleanupHandler(fn?: (err?: void | Error) => void): void;
    stop(err?: Error): void;
    parseOptions(opts: PullConsumerOptions, refilling?: boolean): Record<string, number>;
    status(): Promise<AsyncIterable<ConsumerStatus>>;
}
export declare class OrderedConsumerMessages extends QueuedIteratorImpl<JsMsg> implements ConsumerMessages {
    src: PullConsumerMessagesImpl;
    listeners: QueuedIterator<ConsumerStatus>[];
    constructor();
    setSource(src: PullConsumerMessagesImpl): void;
    notify(type: ConsumerEvents | ConsumerDebugEvents, data: unknown): void;
    stop(err?: Error): void;
    close(): Promise<void | Error>;
    closed(): Promise<void | Error>;
    status(): Promise<AsyncIterable<ConsumerStatus>>;
}
export declare class PullConsumerImpl implements Consumer {
    api: ConsumerAPIImpl;
    _info: ConsumerInfo;
    stream: string;
    name: string;
    constructor(api: ConsumerAPI, info: ConsumerInfo);
    consume(opts?: ConsumeOptions): Promise<ConsumerMessages>;
    fetch(opts?: FetchOptions): Promise<ConsumerMessages>;
    next(opts?: NextOptions): Promise<JsMsg | null>;
    delete(): Promise<boolean>;
    info(cached?: boolean): Promise<ConsumerInfo>;
}
/**
 * These options are a subset of {@link ConsumerConfig} and
 * {@link ConsumerUpdateConfig}
 */
export type OrderedConsumerOptions = {
    name_prefix: string;
    filterSubjects: string[] | string;
    deliver_policy: DeliverPolicy;
    opt_start_seq: number;
    opt_start_time: string;
    replay_policy: ReplayPolicy;
    inactive_threshold: number;
    headers_only: boolean;
};
export declare class OrderedPullConsumerImpl implements Consumer {
    api: ConsumerAPIImpl;
    consumerOpts: Partial<OrderedConsumerOptions>;
    consumer: PullConsumerImpl;
    opts: ConsumeOptions | FetchOptions;
    cursor: {
        stream_seq: number;
        deliver_seq: number;
    };
    stream: string;
    namePrefix: string;
    serial: number;
    currentConsumer: ConsumerInfo | null;
    userCallback: ConsumerCallbackFn | null;
    iter: OrderedConsumerMessages | null;
    type: PullConsumerType;
    startSeq: number;
    maxInitialReset: number;
    constructor(api: ConsumerAPI, stream: string, opts?: Partial<OrderedConsumerOptions>);
    getConsumerOpts(seq: number): ConsumerConfig;
    resetConsumer(seq?: number): Promise<ConsumerInfo>;
    internalHandler(serial: number): (m: JsMsg) => void;
    reset(opts?: ConsumeOptions | FetchOptions, info?: Partial<{
        fromFetch: boolean;
        orderedReset: boolean;
    }>): Promise<void>;
    notifyOrderedResetAndReset(): void;
    consume(opts?: ConsumeOptions): Promise<ConsumerMessages>;
    fetch(opts?: FetchOptions): Promise<ConsumerMessages>;
    next(opts?: NextOptions): Promise<JsMsg | null>;
    delete(): Promise<boolean>;
    info(cached?: boolean): Promise<ConsumerInfo>;
}
export {};
