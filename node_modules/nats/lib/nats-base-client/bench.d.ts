import { Perf } from "./util";
import { NatsConnection } from "./core";
export declare class Metric {
    name: string;
    duration: number;
    date: number;
    payload: number;
    msgs: number;
    lang: string;
    version: string;
    bytes: number;
    asyncRequests?: boolean;
    min?: number;
    max?: number;
    constructor(name: string, duration: number);
    toString(): string;
    toCsv(): string;
    static header(): string;
}
export interface BenchOpts {
    callbacks?: boolean;
    msgs?: number;
    size?: number;
    subject?: string;
    asyncRequests?: boolean;
    pub?: boolean;
    sub?: boolean;
    rep?: boolean;
    req?: boolean;
}
export declare class Bench {
    nc: NatsConnection;
    callbacks: boolean;
    msgs: number;
    size: number;
    subject: string;
    asyncRequests?: boolean;
    pub?: boolean;
    sub?: boolean;
    req?: boolean;
    rep?: boolean;
    perf: Perf;
    payload: Uint8Array;
    constructor(nc: NatsConnection, opts?: BenchOpts);
    run(): Promise<Metric[]>;
    processMetrics(): Metric[];
    runCallbacks(): Promise<void>;
    runAsync(): Promise<void>;
}
export declare function throughput(bytes: number, seconds: number): string;
export declare function msgThroughput(msgs: number, seconds: number): string;
export declare function humanizeBytes(bytes: number, si?: boolean): string;
