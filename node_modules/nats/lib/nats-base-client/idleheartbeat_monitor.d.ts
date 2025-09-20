/**
 * Called with the number of missed heartbeats.
 * If the function returns true, the monitor will cancel monitoring.
 */
export type IdleHeartbeatFn = (n: number) => boolean;
/**
 * IdleHeartbeatOptions
 */
export type IdleHeartbeatOptions = {
    /**
     * @field maxOut - optional maximum number of missed heartbeats before notifying (default is 2)
     */
    maxOut: number;
    /**
     * @field cancelAfter - optional timer to auto cancel monitoring in millis
     */
    cancelAfter: number;
};
export declare class IdleHeartbeatMonitor {
    interval: number;
    maxOut: number;
    cancelAfter: number;
    timer?: number;
    autoCancelTimer?: number;
    last: number;
    missed: number;
    count: number;
    callback: IdleHeartbeatFn;
    /**
     * Constructor
     * @param interval in millis to check
     * @param cb a callback to report when heartbeats are missed
     * @param opts monitor options @see IdleHeartbeatOptions
     */
    constructor(interval: number, cb: IdleHeartbeatFn, opts?: Partial<IdleHeartbeatOptions>);
    /**
     * cancel monitoring
     */
    cancel(): void;
    /**
     * work signals that there was work performed
     */
    work(): void;
    /**
     * internal api to change the interval, cancelAfter and maxOut
     * @param interval
     * @param cancelAfter
     * @param maxOut
     */
    _change(interval: number, cancelAfter?: number, maxOut?: number): void;
    /**
     * cancels and restarts the monitoring
     */
    restart(): void;
    /**
     * internal api called to start monitoring
     */
    _schedule(): void;
}
