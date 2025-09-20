import { DenoBuffer } from "./denobuffer";
import { Dispatcher } from "./core";
export declare enum Kind {
    OK = 0,
    ERR = 1,
    MSG = 2,
    INFO = 3,
    PING = 4,
    PONG = 5
}
export interface ParserEvent {
    kind: Kind;
    msg?: MsgArg;
    data?: Uint8Array;
}
export declare function describe(e: ParserEvent): string;
export interface MsgArg {
    subject: Uint8Array;
    reply?: Uint8Array;
    sid: number;
    hdr: number;
    size: number;
}
export declare class Parser {
    dispatcher: Dispatcher<ParserEvent>;
    state: State;
    as: number;
    drop: number;
    hdr: number;
    ma: MsgArg;
    argBuf?: DenoBuffer;
    msgBuf?: DenoBuffer;
    constructor(dispatcher: Dispatcher<ParserEvent>);
    parse(buf: Uint8Array): void;
    cloneMsgArg(): void;
    processMsgArgs(arg: Uint8Array): void;
    fail(data: Uint8Array, label?: string): Error;
    processHeaderMsgArgs(arg: Uint8Array): void;
    protoParseInt(a: Uint8Array): number;
}
export declare enum State {
    OP_START = 0,
    OP_PLUS = 1,
    OP_PLUS_O = 2,
    OP_PLUS_OK = 3,
    OP_MINUS = 4,
    OP_MINUS_E = 5,
    OP_MINUS_ER = 6,
    OP_MINUS_ERR = 7,
    OP_MINUS_ERR_SPC = 8,
    MINUS_ERR_ARG = 9,
    OP_M = 10,
    OP_MS = 11,
    OP_MSG = 12,
    OP_MSG_SPC = 13,
    MSG_ARG = 14,
    MSG_PAYLOAD = 15,
    MSG_END = 16,
    OP_H = 17,
    OP_P = 18,
    OP_PI = 19,
    OP_PIN = 20,
    OP_PING = 21,
    OP_PO = 22,
    OP_PON = 23,
    OP_PONG = 24,
    OP_I = 25,
    OP_IN = 26,
    OP_INF = 27,
    OP_INFO = 28,
    OP_INFO_SPC = 29,
    INFO_ARG = 30
}
