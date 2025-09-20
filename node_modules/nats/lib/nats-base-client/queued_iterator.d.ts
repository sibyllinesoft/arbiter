import { Deferred } from "./util";
import { QueuedIterator } from "./core";
export type IngestionFilterFnResult = {
    ingest: boolean;
    protocol: boolean;
};
/**
 * IngestionFilterFn prevents a value from being ingested by the
 * iterator. It is executed on `push`. If ingest is false the value
 * shouldn't be pushed. If protcol is true, the value is a protcol
 * value
 *
 * @param: data is the value
 * @src: is the source of the data if set.
 */
export type IngestionFilterFn<T = unknown> = (data: T | null, src?: unknown) => IngestionFilterFnResult;
/**
 * ProtocolFilterFn allows filtering of values that shouldn't be presented
 * to the iterator. ProtocolFilterFn is executed when a value is about to be presented
 *
 * @param data: the value
 * @returns boolean: true if the value should presented to the iterator
 */
export type ProtocolFilterFn<T = unknown> = (data: T | null) => boolean;
/**
 * DispatcherFn allows for values to be processed after being presented
 * to the iterator. Note that if the ProtocolFilter rejected the value
 * it will _not_ be presented to the DispatchedFn. Any processing should
 * instead have been handled by the ProtocolFilterFn.
 * @param data: the value
 */
export type DispatchedFn<T = unknown> = (data: T | null) => void;
export declare class QueuedIteratorImpl<T> implements QueuedIterator<T> {
    inflight: number;
    processed: number;
    received: number;
    noIterator: boolean;
    iterClosed: Deferred<void | Error>;
    done: boolean;
    signal: Deferred<void>;
    yields: T[];
    filtered: number;
    pendingFiltered: number;
    ingestionFilterFn?: IngestionFilterFn<T>;
    protocolFilterFn?: ProtocolFilterFn<T>;
    dispatchedFn?: DispatchedFn<T>;
    ctx?: unknown;
    _data?: unknown;
    err?: Error;
    time: number;
    yielding: boolean;
    constructor();
    [Symbol.asyncIterator](): AsyncIterableIterator<T>;
    push(v: T): void;
    iterate(): AsyncIterableIterator<T>;
    stop(err?: Error): void;
    getProcessed(): number;
    getPending(): number;
    getReceived(): number;
}
