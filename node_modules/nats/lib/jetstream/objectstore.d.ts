import { JetStreamClient, JetStreamManager, ObjectInfo, ObjectResult, ObjectStore, ObjectStoreMeta, ObjectStoreMetaOptions, ObjectStoreOptions, ObjectStorePutOpts, ObjectStoreStatus, PubAck } from "./types";
import { QueuedIterator } from "../nats-base-client/core";
import { PurgeResponse, StorageType, StreamInfo, StreamInfoRequestOptions } from "./jsapi_types";
export declare const osPrefix = "OBJ_";
export declare const digestType = "SHA-256=";
export declare function objectStoreStreamName(bucket: string): string;
export declare function objectStoreBucketName(stream: string): string;
export declare class ObjectStoreStatusImpl implements ObjectStoreStatus {
    si: StreamInfo;
    backingStore: string;
    constructor(si: StreamInfo);
    get bucket(): string;
    get description(): string;
    get ttl(): number;
    get storage(): StorageType;
    get replicas(): number;
    get sealed(): boolean;
    get size(): number;
    get streamInfo(): StreamInfo;
    get metadata(): Record<string, string> | undefined;
    get compression(): boolean;
}
export type ServerObjectStoreMeta = {
    name: string;
    description?: string;
    headers?: Record<string, string[]>;
    options?: ObjectStoreMetaOptions;
};
export type ServerObjectInfo = {
    bucket: string;
    nuid: string;
    size: number;
    chunks: number;
    digest: string;
    deleted?: boolean;
    mtime: string;
    revision: number;
    metadata?: Record<string, string>;
} & ServerObjectStoreMeta;
export declare class ObjectStoreImpl implements ObjectStore {
    jsm: JetStreamManager;
    js: JetStreamClient;
    stream: string;
    name: string;
    constructor(name: string, jsm: JetStreamManager, js: JetStreamClient);
    _checkNotEmpty(name: string): {
        name: string;
        error?: Error;
    };
    info(name: string): Promise<ObjectInfo | null>;
    list(): Promise<ObjectInfo[]>;
    rawInfo(name: string): Promise<ServerObjectInfo | null>;
    _si(opts?: Partial<StreamInfoRequestOptions>): Promise<StreamInfo | null>;
    seal(): Promise<ObjectStoreStatus>;
    status(opts?: Partial<StreamInfoRequestOptions>): Promise<ObjectStoreStatus>;
    destroy(): Promise<boolean>;
    _put(meta: ObjectStoreMeta, rs: ReadableStream<Uint8Array> | null, opts?: ObjectStorePutOpts): Promise<ObjectInfo>;
    putBlob(meta: ObjectStoreMeta, data: Uint8Array | null, opts?: ObjectStorePutOpts): Promise<ObjectInfo>;
    put(meta: ObjectStoreMeta, rs: ReadableStream<Uint8Array> | null, opts?: ObjectStorePutOpts): Promise<ObjectInfo>;
    getBlob(name: string): Promise<Uint8Array | null>;
    get(name: string): Promise<ObjectResult | null>;
    linkStore(name: string, bucket: ObjectStore): Promise<ObjectInfo>;
    link(name: string, info: ObjectInfo): Promise<ObjectInfo>;
    delete(name: string): Promise<PurgeResponse>;
    update(name: string, meta?: Partial<ObjectStoreMeta>): Promise<PubAck>;
    watch(opts?: Partial<{
        ignoreDeletes?: boolean;
        includeHistory?: boolean;
    }>): Promise<QueuedIterator<ObjectInfo | null>>;
    _chunkSubject(id: string): string;
    _metaSubject(n: string): string;
    _metaSubjectAll(): string;
    init(opts?: Partial<ObjectStoreOptions>): Promise<void>;
    static create(js: JetStreamClient, name: string, opts?: Partial<ObjectStoreOptions>): Promise<ObjectStore>;
}
