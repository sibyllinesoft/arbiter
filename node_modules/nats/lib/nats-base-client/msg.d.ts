import type { MsgArg } from "./parser";
import { Codec } from "./codec";
import { Msg, MsgHdrs, NatsError, Publisher, RequestInfo, ReviverFn } from "./core";
export declare function isRequestError(msg: Msg): NatsError | null;
export declare class MsgImpl implements Msg {
    _headers?: MsgHdrs;
    _msg: MsgArg;
    _rdata: Uint8Array;
    _reply: string;
    _subject: string;
    publisher: Publisher;
    static jc: Codec<unknown>;
    constructor(msg: MsgArg, data: Uint8Array, publisher: Publisher);
    get subject(): string;
    get reply(): string;
    get sid(): number;
    get headers(): MsgHdrs | undefined;
    get data(): Uint8Array;
    respond(data?: Uint8Array, opts?: {
        headers?: MsgHdrs;
        reply?: string;
    }): boolean;
    size(): number;
    json<T = unknown>(reviver?: ReviverFn): T;
    string(): string;
    requestInfo(): RequestInfo | null;
}
