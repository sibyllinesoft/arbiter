import { Msg, MsgHdrs } from "../nats-base-client/core";
import { DeliveryInfo, PullOptions } from "./jsapi_types";
export declare const ACK: Uint8Array<ArrayBuffer>;
/**
 * Represents a message stored in JetStream
 */
export interface JsMsg {
    /**
     * True if the message was redelivered
     */
    redelivered: boolean;
    /**
     * The delivery info for the message
     */
    info: DeliveryInfo;
    /**
     * The sequence number for the message
     */
    seq: number;
    /**
     * Any headers associated with the message
     */
    headers: MsgHdrs | undefined;
    /**
     * The message's data
     */
    data: Uint8Array;
    /**
     * The subject on which the message was published
     */
    subject: string;
    /**
     * @ignore
     */
    sid: number;
    /**
     * Indicate to the JetStream server that the message was processed
     * successfully.
     */
    ack(): void;
    /**
     * Indicate to the JetStream server that processing of the message
     * failed, and that it should be resent after the spefied number of
     * milliseconds.
     * @param millis
     */
    nak(millis?: number): void;
    /**
     * Indicate to the JetStream server that processing of the message
     * is on going, and that the ack wait timer for the message should be
     * reset preventing a redelivery.
     */
    working(): void;
    /**
     * !! this is an experimental feature - and could be removed
     *
     * next() combines ack() and pull(), requires the subject for a
     * subscription processing to process a message is provided
     * (can be the same) however, because the ability to specify
     * how long to keep the request open can be specified, this
     * functionality doesn't work well with iterators, as an error
     * (408s) are expected and needed to re-trigger a pull in case
     * there was a timeout. In an iterator, the error will close
     * the iterator, requiring a subscription to be reset.
     */
    next(subj: string, ro?: Partial<PullOptions>): void;
    /**
     * Indicate to the JetStream server that processing of the message
     * failed and that the message should not be sent to the consumer again.
     * @param reason is a string describing why the message was termed. Note
     * that `reason` is only available on servers 2.11.0 or better.
     */
    term(reason?: string): void;
    /**
     * Indicate to the JetStream server that the message was processed
     * successfully and that the JetStream server should acknowledge back
     * that the acknowledgement was received.
     */
    ackAck(opts?: Partial<{
        timeout: number;
    }>): Promise<boolean>;
    /**
     * Convenience method to parse the message payload as JSON. This method
     * will throw an exception if there's a parsing error;
     */
    json<T>(): T;
    /**
     * Convenience method to parse the message payload as string. This method
     * may throw an exception if there's a conversion error
     */
    string(): string;
}
export declare function toJsMsg(m: Msg, ackTimeout?: number): JsMsg;
export declare function parseInfo(s: string): DeliveryInfo;
export declare class JsMsgImpl implements JsMsg {
    msg: Msg;
    di?: DeliveryInfo;
    didAck: boolean;
    timeout: number;
    constructor(msg: Msg, timeout: number);
    get subject(): string;
    get sid(): number;
    get data(): Uint8Array;
    get headers(): MsgHdrs;
    get info(): DeliveryInfo;
    get redelivered(): boolean;
    get reply(): string;
    get seq(): number;
    doAck(payload: Uint8Array): void;
    isWIP(p: Uint8Array): boolean;
    ackAck(opts?: Partial<{
        timeout: number;
    }>): Promise<boolean>;
    ack(): void;
    nak(millis?: number): void;
    working(): void;
    next(subj: string, opts?: Partial<PullOptions>): void;
    term(reason?: string): void;
    json<T = unknown>(): T;
    string(): string;
}
