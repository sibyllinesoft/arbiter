import { Codec } from "../nats-base-client/codec";
import { NatsConnectionImpl } from "../nats-base-client/nats";
import { JetStreamOptions, Msg, NatsConnection, RequestOptions } from "../nats-base-client/core";
export declare function defaultJsOptions(opts?: JetStreamOptions): JetStreamOptions;
export interface StreamNames {
    streams: string[];
}
export interface StreamNameBySubject {
    subject: string;
}
export declare class BaseApiClient {
    nc: NatsConnectionImpl;
    opts: JetStreamOptions;
    prefix: string;
    timeout: number;
    jc: Codec<unknown>;
    constructor(nc: NatsConnection, opts?: JetStreamOptions);
    getOptions(): JetStreamOptions;
    _parseOpts(): void;
    _request(subj: string, data?: unknown, opts?: Partial<RequestOptions> & {
        retries?: number;
    }): Promise<unknown>;
    findStream(subject: string): Promise<string>;
    getConnection(): NatsConnection;
    parseJsResponse(m: Msg): unknown;
}
