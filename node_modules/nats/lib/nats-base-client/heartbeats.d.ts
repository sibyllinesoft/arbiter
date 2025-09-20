import { Deferred } from "./util";
import { Status } from "./core";
export interface PH {
    flush(p?: Deferred<void>): Promise<void>;
    disconnect(): void;
    dispatchStatus(status: Status): void;
}
export declare class Heartbeat {
    ph: PH;
    interval: number;
    maxOut: number;
    timer?: number;
    pendings: Promise<void>[];
    constructor(ph: PH, interval: number, maxOut: number);
    start(): void;
    cancel(stale?: boolean): void;
    _schedule(): void;
    _reset(): void;
}
