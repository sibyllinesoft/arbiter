import { Deferred } from "./util";
import type { DispatchedFn, IngestionFilterFn, ProtocolFilterFn } from "./queued_iterator";
import { QueuedIteratorImpl } from "./queued_iterator";
import { Msg, NatsConnection, NatsError, Sub, SubOpts, Subscription } from "./core";
import { SubscriptionImpl } from "./protocol";
/**
 * Converts a NATS message into some other type. Implementers are expected to:
 * return [err, null] if the message callback is invoked with an error.
 * return [err, null] if converting the message yielded an error, note that
 * iterators will stop on the error, but callbacks will be presented with
 * the error.
 * return [null, T] if the conversion worked correctly
 */
export type MsgAdapter<T> = (err: NatsError | null, msg: Msg) => [NatsError | null, T | null];
/**
 * Callback presented to the user with the converted type
 */
export type TypedCallback<T> = (err: NatsError | null, msg: T | null) => void;
export interface TypedSubscriptionOptions<T> extends SubOpts<T> {
    adapter: MsgAdapter<T>;
    callback?: TypedCallback<T>;
    ingestionFilterFn?: IngestionFilterFn<T>;
    protocolFilterFn?: ProtocolFilterFn<T>;
    dispatchedFn?: DispatchedFn<T>;
    cleanupFn?: (sub: Subscription, info?: unknown) => void;
}
export declare function checkFn(fn: unknown, name: string, required?: boolean): void;
/**
 * TypedSubscription wraps a subscription to provide payload specific
 * subscription semantics. That is messages are a transport
 * for user data, and the data is presented as application specific
 * data to the client.
 */
export declare class TypedSubscription<T> extends QueuedIteratorImpl<T> implements Sub<T> {
    sub: SubscriptionImpl;
    adapter: MsgAdapter<T>;
    subIterDone: Deferred<void>;
    constructor(nc: NatsConnection, subject: string, opts: TypedSubscriptionOptions<T>);
    unsubscribe(max?: number): void;
    drain(): Promise<void>;
    isDraining(): boolean;
    isClosed(): boolean;
    callback(e: NatsError | null, msg: Msg): void;
    getSubject(): string;
    getReceived(): number;
    getProcessed(): number;
    getPending(): number;
    getID(): number;
    getMax(): number | undefined;
    get closed(): Promise<void>;
}
