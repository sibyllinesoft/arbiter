import { BaseApiClient } from "./jsbaseclient_api";
import { ConsumerAPI } from "./jsmconsumer_api";
import { JsMsg } from "./jsmsg";
import { TypedSubscription, TypedSubscriptionOptions } from "../nats-base-client/typedsub";
import { IngestionFilterFn } from "../nats-base-client/queued_iterator";
import { IdleHeartbeatMonitor } from "../nats-base-client/idleheartbeat_monitor";
import { StreamAPIImpl } from "./jsmstream_api";
import { ConsumerInfoable, ConsumerOpts, ConsumerOptsBuilder, Consumers, Destroyable, JetStreamClient, JetStreamManager, JetStreamPublishOptions, JetStreamPullSubscription, JetStreamSubscription, JetStreamSubscriptionInfo, JetStreamSubscriptionInfoable, JetStreamSubscriptionOptions, PubAck, Streams, Views } from "./types";
import { JetStreamOptions, Msg, NatsConnection, Payload, QueuedIterator } from "../nats-base-client/core";
import { ConsumerInfo, PullOptions } from "./jsapi_types";
export declare enum PubHeaders {
    MsgIdHdr = "Nats-Msg-Id",
    ExpectedStreamHdr = "Nats-Expected-Stream",
    ExpectedLastSeqHdr = "Nats-Expected-Last-Sequence",
    ExpectedLastMsgIdHdr = "Nats-Expected-Last-Msg-Id",
    ExpectedLastSubjectSequenceHdr = "Nats-Expected-Last-Subject-Sequence"
}
export declare class JetStreamClientImpl extends BaseApiClient implements JetStreamClient {
    consumers: Consumers;
    streams: Streams;
    consumerAPI: ConsumerAPI;
    streamAPI: StreamAPIImpl;
    constructor(nc: NatsConnection, opts?: JetStreamOptions);
    jetstreamManager(checkAPI?: boolean): Promise<JetStreamManager>;
    get apiPrefix(): string;
    get views(): Views;
    publish(subj: string, data?: Payload, opts?: Partial<JetStreamPublishOptions>): Promise<PubAck>;
    pull(stream: string, durable: string, expires?: number): Promise<JsMsg>;
    fetch(stream: string, durable: string, opts?: Partial<PullOptions>): QueuedIterator<JsMsg>;
    pullSubscribe(subject: string, opts?: ConsumerOptsBuilder | Partial<ConsumerOpts>): Promise<JetStreamPullSubscription>;
    subscribe(subject: string, opts?: ConsumerOptsBuilder | Partial<ConsumerOpts>): Promise<JetStreamSubscription>;
    _processOptions(subject: string, opts?: ConsumerOptsBuilder | Partial<ConsumerOpts>): Promise<JetStreamSubscriptionInfo>;
    _buildTypedSubscriptionOpts(jsi: JetStreamSubscriptionInfo): TypedSubscriptionOptions<JsMsg>;
    _maybeCreateConsumer(jsi: JetStreamSubscriptionInfo): Promise<void>;
    static ingestionFn(ordered: boolean): IngestionFilterFn<JsMsg>;
}
export declare class JetStreamSubscriptionImpl extends TypedSubscription<JsMsg> implements JetStreamSubscriptionInfoable, Destroyable, ConsumerInfoable {
    js: BaseApiClient;
    monitor: IdleHeartbeatMonitor | null;
    constructor(js: BaseApiClient, subject: string, opts: JetStreamSubscriptionOptions);
    set info(info: JetStreamSubscriptionInfo | null);
    get info(): JetStreamSubscriptionInfo | null;
    _resetOrderedConsumer(sseq: number): void;
    _maybeSetupHbMonitoring(): void;
    _setupHbMonitoring(millis: number, cancelAfter?: number): void;
    _checkHbOrderConsumer(msg: Msg): boolean;
    _checkOrderedConsumer(jm: JsMsg): boolean;
    destroy(): Promise<void>;
    consumerInfo(): Promise<ConsumerInfo>;
}
