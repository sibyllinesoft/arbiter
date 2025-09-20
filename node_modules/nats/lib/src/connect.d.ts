import { ConnectionOptions, NatsConnection } from "./nats-base-client";
export declare function connect(opts?: ConnectionOptions): Promise<NatsConnection>;
