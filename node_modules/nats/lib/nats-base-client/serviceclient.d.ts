import { NatsConnection, RequestManyOptions, ServiceIdentity, ServiceInfo, ServiceStats, ServiceVerb } from "./core";
import { QueuedIterator, ServiceClient } from "./core";
export declare class ServiceClientImpl implements ServiceClient {
    nc: NatsConnection;
    prefix: string | undefined;
    opts: RequestManyOptions;
    constructor(nc: NatsConnection, opts?: RequestManyOptions, prefix?: string);
    ping(name?: string, id?: string): Promise<QueuedIterator<ServiceIdentity>>;
    stats(name?: string, id?: string): Promise<QueuedIterator<ServiceStats>>;
    info(name?: string, id?: string): Promise<QueuedIterator<ServiceInfo>>;
    q<T>(v: ServiceVerb, name?: string, id?: string): Promise<QueuedIterator<T>>;
}
