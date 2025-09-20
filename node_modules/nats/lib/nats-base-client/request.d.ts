import { Deferred, Timeout } from "./util";
import { MuxSubscription } from "./muxsubscription";
import { Msg, NatsError, Request, RequestManyOptions, RequestOptions } from "./core";
export declare class BaseRequest {
    token: string;
    received: number;
    ctx?: Error;
    requestSubject: string;
    mux: MuxSubscription;
    constructor(mux: MuxSubscription, requestSubject: string, asyncTraces?: boolean);
}
export interface RequestManyOptionsInternal extends RequestManyOptions {
    callback: (err: Error | null, msg: Msg | null) => void;
}
/**
 * Request expects multiple message response
 * the request ends when the timer expires,
 * an error arrives or an expected count of messages
 * arrives, end is signaled by a null message
 */
export declare class RequestMany extends BaseRequest implements Request {
    callback: (err: Error | null, msg: Msg | null) => void;
    done: Deferred<void>;
    timer: number;
    max: number;
    opts: Partial<RequestManyOptionsInternal>;
    constructor(mux: MuxSubscription, requestSubject: string, opts?: Partial<RequestManyOptions>);
    cancel(err?: NatsError): void;
    resolver(err: Error | null, msg: Msg): void;
}
export declare class RequestOne extends BaseRequest implements Request {
    deferred: Deferred<Msg>;
    timer: Timeout<Msg>;
    constructor(mux: MuxSubscription, requestSubject: string, opts?: RequestOptions, asyncTraces?: boolean);
    resolver(err: Error | null, msg: Msg): void;
    cancel(err?: NatsError): void;
}
