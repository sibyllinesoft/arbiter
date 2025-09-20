import { BaseApiClient } from "./jsbaseclient_api";
import { Lister } from "./jslister";
import { JetStreamOptions, Nanos, NatsConnection } from "../nats-base-client/core";
import { ConsumerApiAction, ConsumerConfig, ConsumerInfo, ConsumerUpdateConfig } from "./jsapi_types";
export interface ConsumerAPI {
    /**
     * Returns the ConsumerInfo for the specified consumer in the specified stream.
     * @param stream
     * @param consumer
     */
    info(stream: string, consumer: string): Promise<ConsumerInfo>;
    /**
     * Adds a new consumer to the specified stream with the specified consumer options.
     * @param stream
     * @param cfg
     */
    add(stream: string, cfg: Partial<ConsumerConfig>): Promise<ConsumerInfo>;
    /**
     * Updates the consumer configuration for the specified consumer on the specified
     * stream that has the specified durable name.
     * @param stream
     * @param durable
     * @param cfg
     */
    update(stream: string, durable: string, cfg: Partial<ConsumerUpdateConfig>): Promise<ConsumerInfo>;
    /**
     * Deletes the specified consumer name/durable from the specified stream.
     * @param stream
     * @param consumer
     */
    delete(stream: string, consumer: string): Promise<boolean>;
    /**
     * Lists all the consumers on the specfied streams
     * @param stream
     */
    list(stream: string): Lister<ConsumerInfo>;
    pause(stream: string, name: string, until?: Date): Promise<{
        paused: boolean;
        pause_until?: string;
    }>;
    resume(stream: string, name: string): Promise<{
        paused: boolean;
        pause_until?: string;
    }>;
}
export declare class ConsumerAPIImpl extends BaseApiClient implements ConsumerAPI {
    constructor(nc: NatsConnection, opts?: JetStreamOptions);
    add(stream: string, cfg: ConsumerConfig, action?: ConsumerApiAction): Promise<ConsumerInfo>;
    update(stream: string, durable: string, cfg: ConsumerUpdateConfig): Promise<ConsumerInfo>;
    info(stream: string, name: string): Promise<ConsumerInfo>;
    delete(stream: string, name: string): Promise<boolean>;
    list(stream: string): Lister<ConsumerInfo>;
    pause(stream: string, name: string, until: Date): Promise<{
        paused: boolean;
        pause_until: string;
        pause_remaining: Nanos;
    }>;
    resume(stream: string, name: string): Promise<{
        paused: boolean;
        pause_until?: string;
    }>;
}
