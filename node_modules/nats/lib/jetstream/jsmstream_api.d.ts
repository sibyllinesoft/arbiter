import { MsgHdrs } from "../nats-base-client/types";
import { BaseApiClient } from "./jsbaseclient_api";
import { Lister } from "./jslister";
import { Codec } from "../nats-base-client/codec";
import { Consumers, KvStatus, ObjectStoreStatus, StoredMsg, Stream, StreamAPI, Streams } from "./types";
import { JetStreamOptions, NatsConnection, ReviverFn } from "../nats-base-client/core";
import { ConsumerInfo, MsgRequest, PurgeOpts, PurgeResponse, StreamAlternate, StreamConfig, StreamInfo, StreamInfoRequestOptions, StreamMsgResponse, StreamSource, StreamUpdateConfig } from "./jsapi_types";
import { Consumer, OrderedConsumerOptions } from "./consumer";
import { ConsumerAPI } from "./jsmconsumer_api";
export declare function convertStreamSourceDomain(s?: StreamSource): StreamSource;
export declare class ConsumersImpl implements Consumers {
    api: ConsumerAPI;
    notified: boolean;
    constructor(api: ConsumerAPI);
    checkVersion(): Promise<void>;
    getPullConsumerFor(ci: ConsumerInfo): Consumer;
    get(stream: string, name?: string | Partial<OrderedConsumerOptions>): Promise<Consumer>;
    ordered(stream: string, opts?: Partial<OrderedConsumerOptions>): Promise<Consumer>;
}
export declare class StreamImpl implements Stream {
    api: StreamAPIImpl;
    _info: StreamInfo;
    constructor(api: StreamAPI, info: StreamInfo);
    get name(): string;
    alternates(): Promise<StreamAlternate[]>;
    best(): Promise<Stream>;
    info(cached?: boolean, opts?: Partial<StreamInfoRequestOptions>): Promise<StreamInfo>;
    getConsumerFromInfo(ci: ConsumerInfo): Consumer;
    getConsumer(name?: string | Partial<OrderedConsumerOptions>): Promise<Consumer>;
    getMessage(query: MsgRequest): Promise<StoredMsg>;
    deleteMessage(seq: number, erase?: boolean): Promise<boolean>;
}
export declare class StreamAPIImpl extends BaseApiClient implements StreamAPI {
    constructor(nc: NatsConnection, opts?: JetStreamOptions);
    checkStreamConfigVersions(cfg: Partial<StreamConfig>): void;
    add(cfg?: Partial<StreamConfig>): Promise<StreamInfo>;
    delete(stream: string): Promise<boolean>;
    update(name: string, cfg?: Partial<StreamUpdateConfig>): Promise<StreamInfo>;
    info(name: string, data?: Partial<StreamInfoRequestOptions>): Promise<StreamInfo>;
    list(subject?: string): Lister<StreamInfo>;
    _fixInfo(si: StreamInfo): void;
    purge(name: string, opts?: PurgeOpts): Promise<PurgeResponse>;
    deleteMessage(stream: string, seq: number, erase?: boolean): Promise<boolean>;
    getMessage(stream: string, query: MsgRequest): Promise<StoredMsg>;
    find(subject: string): Promise<string>;
    listKvs(): Lister<KvStatus>;
    listObjectStores(): Lister<ObjectStoreStatus>;
    names(subject?: string): Lister<string>;
    get(name: string): Promise<Stream>;
}
export declare class StoredMsgImpl implements StoredMsg {
    _header?: MsgHdrs;
    smr: StreamMsgResponse;
    static jc?: Codec<unknown>;
    constructor(smr: StreamMsgResponse);
    get subject(): string;
    get seq(): number;
    get timestamp(): string;
    get time(): Date;
    get data(): Uint8Array;
    get header(): MsgHdrs;
    _parse(s: string): Uint8Array;
    json<T = unknown>(reviver?: ReviverFn): T;
    string(): string;
}
export declare class StreamsImpl implements Streams {
    api: StreamAPIImpl;
    constructor(api: StreamAPI);
    get(stream: string): Promise<Stream>;
}
