import { BaseApiClient } from "./jsbaseclient_api";
import { ApiPaged, ApiResponse } from "./jsapi_types";
/**
 * An interface for listing. Returns a promise with typed list.
 */
export interface Lister<T> {
    [Symbol.asyncIterator](): AsyncIterator<T>;
    next(): Promise<T[]>;
}
export type ListerFieldFilter<T> = (v: unknown) => T[];
export declare class ListerImpl<T> implements Lister<T>, AsyncIterable<T> {
    err?: Error;
    offset: number;
    pageInfo: ApiPaged;
    subject: string;
    jsm: BaseApiClient;
    filter: ListerFieldFilter<T>;
    payload: unknown;
    constructor(subject: string, filter: ListerFieldFilter<T>, jsm: BaseApiClient, payload?: unknown);
    next(): Promise<T[]>;
    countResponse(r?: ApiResponse): number;
    [Symbol.asyncIterator](): AsyncGenerator<Awaited<T>, void, unknown>;
}
