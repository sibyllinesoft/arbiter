export type SemVer = {
    major: number;
    minor: number;
    micro: number;
};
export declare function parseSemVer(s?: string): SemVer;
export declare function compare(a: SemVer, b: SemVer): number;
export declare enum Feature {
    JS_KV = "js_kv",
    JS_OBJECTSTORE = "js_objectstore",
    JS_PULL_MAX_BYTES = "js_pull_max_bytes",
    JS_NEW_CONSUMER_CREATE_API = "js_new_consumer_create",
    JS_ALLOW_DIRECT = "js_allow_direct",
    JS_MULTIPLE_CONSUMER_FILTER = "js_multiple_consumer_filter",
    JS_SIMPLIFICATION = "js_simplification",
    JS_STREAM_CONSUMER_METADATA = "js_stream_consumer_metadata",
    JS_CONSUMER_FILTER_SUBJECTS = "js_consumer_filter_subjects",
    JS_STREAM_FIRST_SEQ = "js_stream_first_seq",
    JS_STREAM_SUBJECT_TRANSFORM = "js_stream_subject_transform",
    JS_STREAM_SOURCE_SUBJECT_TRANSFORM = "js_stream_source_subject_transform",
    JS_STREAM_COMPRESSION = "js_stream_compression",
    JS_DEFAULT_CONSUMER_LIMITS = "js_default_consumer_limits",
    JS_BATCH_DIRECT_GET = "js_batch_direct_get"
}
type FeatureVersion = {
    ok: boolean;
    min: string;
};
export declare class Features {
    server: SemVer;
    features: Map<Feature, FeatureVersion>;
    disabled: Feature[];
    constructor(v: SemVer);
    /**
     * Removes all disabled entries
     */
    resetDisabled(): void;
    /**
     * Disables a particular feature.
     * @param f
     */
    disable(f: Feature): void;
    isDisabled(f: Feature): boolean;
    update(v: SemVer | string): void;
    /**
     * Register a feature that requires a particular server version.
     * @param f
     * @param requires
     */
    set(f: Feature, requires: string): void;
    /**
     * Returns whether the feature is available and the min server
     * version that supports it.
     * @param f
     */
    get(f: Feature): FeatureVersion;
    /**
     * Returns true if the feature is supported
     * @param f
     */
    supports(f: Feature): boolean;
    /**
     * Returns true if the server is at least the specified version
     * @param v
     */
    require(v: SemVer | string): boolean;
}
export {};
