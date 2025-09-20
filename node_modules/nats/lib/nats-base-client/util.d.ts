import { Nanos } from "./core";
export type ValueResult<T> = {
    isError: false;
    value: T;
};
export type ErrorResult = {
    isError: true;
    error: Error;
};
/**
 * Result is a value that may have resulted in an error.
 */
export type Result<T> = ValueResult<T> | ErrorResult;
export declare function extend(a: any, ...b: any[]): any;
export interface Pending {
    pending: number;
    write: (c: number) => void;
    wrote: (c: number) => void;
    err: (err: Error) => void;
    close: () => void;
    promise: () => Promise<any>;
    resolved: boolean;
    done: boolean;
}
export declare function render(frame: Uint8Array): string;
export interface Timeout<T> extends Promise<T> {
    cancel: () => void;
}
export declare function timeout<T>(ms: number, asyncTraces?: boolean): Timeout<T>;
export interface Delay extends Promise<void> {
    cancel: () => void;
}
export declare function delay(ms?: number): Delay;
export declare function deadline<T>(p: Promise<T>, millis?: number): Promise<T>;
export interface Deferred<T> extends Promise<T> {
    /**
     * Resolves the Deferred to a value T
     * @param value
     */
    resolve: (value?: T | PromiseLike<T>) => void;
    /**
     * Rejects the Deferred
     * @param reason
     */
    reject: (reason?: any) => void;
}
/**
 * Returns a Promise that has a resolve/reject methods that can
 * be used to resolve and defer the Deferred.
 */
export declare function deferred<T>(): Deferred<T>;
export declare function debugDeferred<T>(): Deferred<T>;
export declare function shuffle<T>(a: T[]): T[];
export declare function collect<T>(iter: AsyncIterable<T>): Promise<T[]>;
export declare class Perf {
    timers: Map<string, number>;
    measures: Map<string, number>;
    constructor();
    mark(key: string): void;
    measure(key: string, startKey: string, endKey: string): void;
    getEntries(): {
        name: string;
        duration: number;
    }[];
}
export declare class SimpleMutex {
    max: number;
    current: number;
    waiting: Deferred<void>[];
    /**
     * @param max number of concurrent operations
     */
    constructor(max?: number);
    /**
     * Returns a promise that resolves when the mutex is acquired
     */
    lock(): Promise<void>;
    /**
     * Release an acquired mutex - must be called
     */
    unlock(): void;
}
/**
 * Returns a new number between  .5*n and 1.5*n.
 * If the n is 0, returns 0.
 * @param n
 */
export declare function jitter(n: number): number;
export interface Backoff {
    backoff(attempt: number): number;
}
export declare function backoffWithMax(max?: number): Backoff;
/**
 * Returns a Backoff with the specified interval policy set.
 * @param policy
 */
export declare function backoff(policy?: number[]): Backoff;
/**
 * Converts the specified millis into Nanos
 * @param millis
 */
export declare function nanos(millis: number): Nanos;
/**
 * Convert the specified Nanos into millis
 * @param ns
 */
export declare function millis(ns: Nanos): number;
