import { BaseApiClient } from "./jsbaseclient_api";
import { ConsumerAPI } from "./jsmconsumer_api";
import { Advisory, DirectMsg, DirectStreamAPI, JetStreamClient, JetStreamManager, StoredMsg, StreamAPI } from "./types";
import { JetStreamOptions, Msg, MsgHdrs, NatsConnection, QueuedIterator, ReviverFn } from "../nats-base-client/core";
import { DirectBatchOptions, DirectMsgRequest, JetStreamAccountStats } from "./jsapi_types";
import { Codec } from "../nats-base-client/codec";
export declare class DirectStreamAPIImpl extends BaseApiClient implements DirectStreamAPI {
    constructor(nc: NatsConnection, opts?: JetStreamOptions);
    getMessage(stream: string, query: DirectMsgRequest): Promise<StoredMsg>;
    getBatch(stream: string, opts: DirectBatchOptions): Promise<QueuedIterator<StoredMsg>>;
}
export declare class DirectMsgImpl implements DirectMsg {
    data: Uint8Array;
    header: MsgHdrs;
    static jc?: Codec<unknown>;
    constructor(m: Msg);
    get subject(): string;
    get seq(): number;
    get time(): Date;
    get timestamp(): string;
    get stream(): string;
    json<T = unknown>(reviver?: ReviverFn): T;
    string(): string;
}
export declare class JetStreamManagerImpl extends BaseApiClient implements JetStreamManager {
    streams: StreamAPI;
    consumers: ConsumerAPI;
    direct: DirectStreamAPI;
    constructor(nc: NatsConnection, opts?: JetStreamOptions);
    getAccountInfo(): Promise<JetStreamAccountStats>;
    jetstream(): JetStreamClient;
    advisories(): AsyncIterable<Advisory>;
}
