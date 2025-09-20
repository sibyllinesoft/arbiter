"use strict";
/*
 * Copyright 2021-2024 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KvStatusImpl = exports.Bucket = exports.kvOperationHdr = void 0;
exports.Base64KeyCodec = Base64KeyCodec;
exports.NoopKvCodecs = NoopKvCodecs;
exports.defaultBucketOpts = defaultBucketOpts;
exports.validateKey = validateKey;
exports.validateSearchKey = validateSearchKey;
exports.hasWildcards = hasWildcards;
exports.validateBucket = validateBucket;
const core_1 = require("../nats-base-client/core");
const queued_iterator_1 = require("../nats-base-client/queued_iterator");
const headers_1 = require("../nats-base-client/headers");
const types_1 = require("./types");
const semver_1 = require("../nats-base-client/semver");
const util_1 = require("../nats-base-client/util");
const encoders_1 = require("../nats-base-client/encoders");
const jsapi_types_1 = require("./jsapi_types");
const jsclient_1 = require("./jsclient");
const nuid_1 = require("../nats-base-client/nuid");
function Base64KeyCodec() {
    return {
        encode(key) {
            return btoa(key);
        },
        decode(bkey) {
            return atob(bkey);
        },
    };
}
function NoopKvCodecs() {
    return {
        key: {
            encode(k) {
                return k;
            },
            decode(k) {
                return k;
            },
        },
        value: {
            encode(v) {
                return v;
            },
            decode(v) {
                return v;
            },
        },
    };
}
function defaultBucketOpts() {
    return {
        replicas: 1,
        history: 1,
        timeout: 2000,
        max_bytes: -1,
        maxValueSize: -1,
        codec: NoopKvCodecs(),
        storage: jsapi_types_1.StorageType.File,
    };
}
exports.kvOperationHdr = "KV-Operation";
const kvSubjectPrefix = "$KV";
const validKeyRe = /^[-/=.\w]+$/;
const validSearchKey = /^[-/=.>*\w]+$/;
const validBucketRe = /^[-\w]+$/;
// this exported for tests
function validateKey(k) {
    if (k.startsWith(".") || k.endsWith(".") || !validKeyRe.test(k)) {
        throw new Error(`invalid key: ${k}`);
    }
}
function validateSearchKey(k) {
    if (k.startsWith(".") || k.endsWith(".") || !validSearchKey.test(k)) {
        throw new Error(`invalid key: ${k}`);
    }
}
function hasWildcards(k) {
    if (k.startsWith(".") || k.endsWith(".")) {
        throw new Error(`invalid key: ${k}`);
    }
    const chunks = k.split(".");
    let hasWildcards = false;
    for (let i = 0; i < chunks.length; i++) {
        switch (chunks[i]) {
            case "*":
                hasWildcards = true;
                break;
            case ">":
                if (i !== chunks.length - 1) {
                    throw new Error(`invalid key: ${k}`);
                }
                hasWildcards = true;
                break;
            default:
            // continue
        }
    }
    return hasWildcards;
}
// this exported for tests
function validateBucket(name) {
    if (!validBucketRe.test(name)) {
        throw new Error(`invalid bucket name: ${name}`);
    }
}
class Bucket {
    constructor(bucket, js, jsm) {
        this.validateKey = validateKey;
        this.validateSearchKey = validateSearchKey;
        this.hasWildcards = hasWildcards;
        validateBucket(bucket);
        this.js = js;
        this.jsm = jsm;
        this.bucket = bucket;
        this.prefix = kvSubjectPrefix;
        this.editPrefix = "";
        this.useJsPrefix = false;
        this._prefixLen = 0;
    }
    static create(js_1, name_1) {
        return __awaiter(this, arguments, void 0, function* (js, name, opts = {}) {
            validateBucket(name);
            const jsm = yield js.jetstreamManager();
            const bucket = new Bucket(name, js, jsm);
            yield bucket.init(opts);
            return bucket;
        });
    }
    static bind(js_1, name_1) {
        return __awaiter(this, arguments, void 0, function* (js, name, opts = {}) {
            var _a, _b;
            const jsm = yield js.jetstreamManager();
            const info = {
                config: {
                    allow_direct: opts.allow_direct,
                },
            };
            validateBucket(name);
            const bucket = new Bucket(name, js, jsm);
            info.config.name = (_a = opts.streamName) !== null && _a !== void 0 ? _a : bucket.bucketName();
            Object.assign(bucket, info);
            bucket.stream = info.config.name;
            bucket.codec = opts.codec || NoopKvCodecs();
            bucket.direct = (_b = info.config.allow_direct) !== null && _b !== void 0 ? _b : false;
            bucket.initializePrefixes(info);
            return bucket;
        });
    }
    init() {
        return __awaiter(this, arguments, void 0, function* (opts = {}) {
            var _a, _b;
            const bo = Object.assign(defaultBucketOpts(), opts);
            this.codec = bo.codec;
            const sc = {};
            this.stream = sc.name = (_a = opts.streamName) !== null && _a !== void 0 ? _a : this.bucketName();
            sc.retention = jsapi_types_1.RetentionPolicy.Limits;
            sc.max_msgs_per_subject = bo.history;
            if (bo.maxBucketSize) {
                bo.max_bytes = bo.maxBucketSize;
            }
            if (bo.max_bytes) {
                sc.max_bytes = bo.max_bytes;
            }
            sc.max_msg_size = bo.maxValueSize;
            sc.storage = bo.storage;
            const location = (_b = opts.placementCluster) !== null && _b !== void 0 ? _b : "";
            if (location) {
                opts.placement = {};
                opts.placement.cluster = location;
                opts.placement.tags = [];
            }
            if (opts.placement) {
                sc.placement = opts.placement;
            }
            if (opts.republish) {
                sc.republish = opts.republish;
            }
            if (opts.description) {
                sc.description = opts.description;
            }
            if (opts.mirror) {
                const mirror = Object.assign({}, opts.mirror);
                if (!mirror.name.startsWith(types_1.kvPrefix)) {
                    mirror.name = `${types_1.kvPrefix}${mirror.name}`;
                }
                sc.mirror = mirror;
                sc.mirror_direct = true;
            }
            else if (opts.sources) {
                const sources = opts.sources.map((s) => {
                    const c = Object.assign({}, s);
                    const srcBucketName = c.name.startsWith(types_1.kvPrefix)
                        ? c.name.substring(types_1.kvPrefix.length)
                        : c.name;
                    if (!c.name.startsWith(types_1.kvPrefix)) {
                        c.name = `${types_1.kvPrefix}${c.name}`;
                    }
                    if (!s.external && srcBucketName !== this.bucket) {
                        c.subject_transforms = [
                            { src: `$KV.${srcBucketName}.>`, dest: `$KV.${this.bucket}.>` },
                        ];
                    }
                    return c;
                });
                sc.sources = sources;
                sc.subjects = [this.subjectForBucket()];
            }
            else {
                sc.subjects = [this.subjectForBucket()];
            }
            if (opts.metadata) {
                sc.metadata = opts.metadata;
            }
            if (typeof opts.compression === "boolean") {
                sc.compression = opts.compression
                    ? jsapi_types_1.StoreCompression.S2
                    : jsapi_types_1.StoreCompression.None;
            }
            const nci = this.js.nc;
            const have = nci.getServerVersion();
            const discardNew = have ? (0, semver_1.compare)(have, (0, semver_1.parseSemVer)("2.7.2")) >= 0 : false;
            sc.discard = discardNew ? jsapi_types_1.DiscardPolicy.New : jsapi_types_1.DiscardPolicy.Old;
            const { ok: direct, min } = nci.features.get(semver_1.Feature.JS_ALLOW_DIRECT);
            if (!direct && opts.allow_direct === true) {
                const v = have
                    ? `${have.major}.${have.minor}.${have.micro}`
                    : "unknown";
                return Promise.reject(new Error(`allow_direct is not available on server version ${v} - requires ${min}`));
            }
            // if we are given allow_direct we use it, otherwise what
            // the server supports - in creation this will always rule,
            // but allows the client to opt-in even if it is already
            // available on the stream
            opts.allow_direct = typeof opts.allow_direct === "boolean"
                ? opts.allow_direct
                : direct;
            sc.allow_direct = opts.allow_direct;
            this.direct = sc.allow_direct;
            sc.num_replicas = bo.replicas;
            if (bo.ttl) {
                sc.max_age = (0, util_1.nanos)(bo.ttl);
            }
            sc.allow_rollup_hdrs = true;
            let info;
            try {
                info = yield this.jsm.streams.info(sc.name);
                if (!info.config.allow_direct && this.direct === true) {
                    this.direct = false;
                }
            }
            catch (err) {
                if (err.message === "stream not found") {
                    info = yield this.jsm.streams.add(sc);
                }
                else {
                    throw err;
                }
            }
            this.initializePrefixes(info);
        });
    }
    initializePrefixes(info) {
        this._prefixLen = 0;
        this.prefix = `$KV.${this.bucket}`;
        this.useJsPrefix = this.js.apiPrefix !== "$JS.API";
        const { mirror } = info.config;
        if (mirror) {
            let n = mirror.name;
            if (n.startsWith(types_1.kvPrefix)) {
                n = n.substring(types_1.kvPrefix.length);
            }
            if (mirror.external && mirror.external.api !== "") {
                const mb = mirror.name.substring(types_1.kvPrefix.length);
                this.useJsPrefix = false;
                this.prefix = `$KV.${mb}`;
                this.editPrefix = `${mirror.external.api}.$KV.${n}`;
            }
            else {
                this.editPrefix = this.prefix;
            }
        }
    }
    bucketName() {
        var _a;
        return (_a = this.stream) !== null && _a !== void 0 ? _a : `${types_1.kvPrefix}${this.bucket}`;
    }
    subjectForBucket() {
        return `${this.prefix}.${this.bucket}.>`;
    }
    subjectForKey(k, edit = false) {
        const builder = [];
        if (edit) {
            if (this.useJsPrefix) {
                builder.push(this.js.apiPrefix);
            }
            if (this.editPrefix !== "") {
                builder.push(this.editPrefix);
            }
            else {
                builder.push(this.prefix);
            }
        }
        else {
            if (this.prefix) {
                builder.push(this.prefix);
            }
        }
        builder.push(k);
        return builder.join(".");
    }
    fullKeyName(k) {
        if (this.prefix !== "") {
            return `${this.prefix}.${k}`;
        }
        return `${kvSubjectPrefix}.${this.bucket}.${k}`;
    }
    get prefixLen() {
        if (this._prefixLen === 0) {
            this._prefixLen = this.prefix.length + 1;
        }
        return this._prefixLen;
    }
    encodeKey(key) {
        const chunks = [];
        for (const t of key.split(".")) {
            switch (t) {
                case ">":
                case "*":
                    chunks.push(t);
                    break;
                default:
                    chunks.push(this.codec.key.encode(t));
                    break;
            }
        }
        return chunks.join(".");
    }
    decodeKey(ekey) {
        const chunks = [];
        for (const t of ekey.split(".")) {
            switch (t) {
                case ">":
                case "*":
                    chunks.push(t);
                    break;
                default:
                    chunks.push(this.codec.key.decode(t));
                    break;
            }
        }
        return chunks.join(".");
    }
    close() {
        return Promise.resolve();
    }
    dataLen(data, h) {
        const slen = h ? h.get(types_1.JsHeaders.MessageSizeHdr) || "" : "";
        if (slen !== "") {
            return parseInt(slen, 10);
        }
        return data.length;
    }
    smToEntry(sm) {
        return new KvStoredEntryImpl(this.bucket, this.prefixLen, sm);
    }
    jmToEntry(jm) {
        const key = this.decodeKey(jm.subject.substring(this.prefixLen));
        return new KvJsMsgEntryImpl(this.bucket, key, jm);
    }
    create(k, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            let firstErr;
            try {
                const n = yield this.put(k, data, { previousSeq: 0 });
                return Promise.resolve(n);
            }
            catch (err) {
                firstErr = err;
                if (((_a = err === null || err === void 0 ? void 0 : err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) !== 10071) {
                    return Promise.reject(err);
                }
            }
            let rev = 0;
            try {
                const e = yield this.get(k);
                if ((e === null || e === void 0 ? void 0 : e.operation) === "DEL" || (e === null || e === void 0 ? void 0 : e.operation) === "PURGE") {
                    rev = e !== null ? e.revision : 0;
                    return this.update(k, data, rev);
                }
                else {
                    return Promise.reject(firstErr);
                }
            }
            catch (err) {
                return Promise.reject(err);
            }
        });
    }
    update(k, data, version) {
        if (version <= 0) {
            throw new Error("version must be greater than 0");
        }
        return this.put(k, data, { previousSeq: version });
    }
    put(k_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (k, data, opts = {}) {
            var _a, _b;
            const ek = this.encodeKey(k);
            this.validateKey(ek);
            const o = {};
            if (opts.previousSeq !== undefined) {
                const h = (0, headers_1.headers)();
                o.headers = h;
                h.set(jsclient_1.PubHeaders.ExpectedLastSubjectSequenceHdr, `${opts.previousSeq}`);
            }
            try {
                const pa = yield this.js.publish(this.subjectForKey(ek, true), data, o);
                return pa.seq;
            }
            catch (err) {
                const ne = err;
                if (ne.isJetStreamError()) {
                    ne.message = (_a = ne.api_error) === null || _a === void 0 ? void 0 : _a.description;
                    ne.code = `${(_b = ne.api_error) === null || _b === void 0 ? void 0 : _b.code}`;
                    return Promise.reject(ne);
                }
                return Promise.reject(err);
            }
        });
    }
    get(k, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const ek = this.encodeKey(k);
            this.validateKey(ek);
            let arg = { last_by_subj: this.subjectForKey(ek) };
            if (opts && opts.revision > 0) {
                arg = { seq: opts.revision };
            }
            let sm;
            try {
                if (this.direct) {
                    const direct = this.jsm.direct;
                    sm = yield direct.getMessage(this.bucketName(), arg);
                }
                else {
                    sm = yield this.jsm.streams.getMessage(this.bucketName(), arg);
                }
                const ke = this.smToEntry(sm);
                if (ke.key !== ek) {
                    return null;
                }
                return ke;
            }
            catch (err) {
                if (err.code === core_1.ErrorCode.JetStream404NoMessages) {
                    return null;
                }
                throw err;
            }
        });
    }
    purge(k, opts) {
        return this._deleteOrPurge(k, "PURGE", opts);
    }
    delete(k, opts) {
        return this._deleteOrPurge(k, "DEL", opts);
    }
    purgeDeletes() {
        return __awaiter(this, arguments, void 0, function* (olderMillis = 30 * 60 * 1000) {
            const done = (0, util_1.deferred)();
            const buf = [];
            const i = yield this.watch({
                key: ">",
                initializedFn: () => {
                    done.resolve();
                },
            });
            (() => __awaiter(this, void 0, void 0, function* () {
                var _a, e_1, _b, _c;
                try {
                    for (var _d = true, i_1 = __asyncValues(i), i_1_1; i_1_1 = yield i_1.next(), _a = i_1_1.done, !_a; _d = true) {
                        _c = i_1_1.value;
                        _d = false;
                        const e = _c;
                        if (e.operation === "DEL" || e.operation === "PURGE") {
                            buf.push(e);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = i_1.return)) yield _b.call(i_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }))().then();
            yield done;
            i.stop();
            const min = Date.now() - olderMillis;
            const proms = buf.map((e) => {
                const subj = this.subjectForKey(e.key);
                if (e.created.getTime() >= min) {
                    return this.jsm.streams.purge(this.stream, { filter: subj, keep: 1 });
                }
                else {
                    return this.jsm.streams.purge(this.stream, { filter: subj, keep: 0 });
                }
            });
            const purged = yield Promise.all(proms);
            purged.unshift({ success: true, purged: 0 });
            return purged.reduce((pv, cv) => {
                pv.purged += cv.purged;
                return pv;
            });
        });
    }
    _deleteOrPurge(k, op, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            if (!this.hasWildcards(k)) {
                return this._doDeleteOrPurge(k, op, opts);
            }
            const iter = yield this.keys(k);
            const buf = [];
            try {
                for (var _d = true, iter_1 = __asyncValues(iter), iter_1_1; iter_1_1 = yield iter_1.next(), _a = iter_1_1.done, !_a; _d = true) {
                    _c = iter_1_1.value;
                    _d = false;
                    const k = _c;
                    buf.push(this._doDeleteOrPurge(k, op));
                    if (buf.length === 100) {
                        yield Promise.all(buf);
                        buf.length = 0;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = iter_1.return)) yield _b.call(iter_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            if (buf.length > 0) {
                yield Promise.all(buf);
            }
        });
    }
    _doDeleteOrPurge(k, op, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const ek = this.encodeKey(k);
            this.validateKey(ek);
            const h = (0, headers_1.headers)();
            h.set(exports.kvOperationHdr, op);
            if (op === "PURGE") {
                h.set(types_1.JsHeaders.RollupHdr, types_1.JsHeaders.RollupValueSubject);
            }
            if (opts === null || opts === void 0 ? void 0 : opts.previousSeq) {
                h.set(jsclient_1.PubHeaders.ExpectedLastSubjectSequenceHdr, `${opts.previousSeq}`);
            }
            yield this.js.publish(this.subjectForKey(ek, true), encoders_1.Empty, { headers: h });
        });
    }
    _buildCC(k, content, opts = {}) {
        const a = !Array.isArray(k) ? [k] : k;
        let filter_subjects = a.map((k) => {
            const ek = this.encodeKey(k);
            this.validateSearchKey(k);
            return this.fullKeyName(ek);
        });
        let deliver_policy = jsapi_types_1.DeliverPolicy.LastPerSubject;
        if (content === types_1.KvWatchInclude.AllHistory) {
            deliver_policy = jsapi_types_1.DeliverPolicy.All;
        }
        if (content === types_1.KvWatchInclude.UpdatesOnly) {
            deliver_policy = jsapi_types_1.DeliverPolicy.New;
        }
        let filter_subject = undefined;
        if (filter_subjects.length === 1) {
            filter_subject = filter_subjects[0];
            filter_subjects = undefined;
        }
        return Object.assign({
            deliver_policy,
            "ack_policy": jsapi_types_1.AckPolicy.None,
            filter_subjects,
            filter_subject,
            "flow_control": true,
            "idle_heartbeat": (0, util_1.nanos)(5 * 1000),
        }, opts);
    }
    remove(k) {
        return this.purge(k);
    }
    history() {
        return __awaiter(this, arguments, void 0, function* (opts = {}) {
            var _a;
            const k = (_a = opts.key) !== null && _a !== void 0 ? _a : ">";
            const qi = new queued_iterator_1.QueuedIteratorImpl();
            const co = {};
            co.headers_only = opts.headers_only || false;
            let fn;
            fn = () => {
                qi.stop();
            };
            let count = 0;
            const cc = this._buildCC(k, types_1.KvWatchInclude.AllHistory, co);
            const subj = cc.filter_subject;
            const copts = (0, types_1.consumerOpts)(cc);
            copts.bindStream(this.stream);
            copts.orderedConsumer();
            copts.callback((err, jm) => {
                if (err) {
                    // sub done
                    qi.stop(err);
                    return;
                }
                if (jm) {
                    const e = this.jmToEntry(jm);
                    qi.push(e);
                    qi.received++;
                    //@ts-ignore - function will be removed
                    if (fn && count > 0 && qi.received >= count || jm.info.pending === 0) {
                        //@ts-ignore: we are injecting an unexpected type
                        qi.push(fn);
                        fn = undefined;
                    }
                }
            });
            const sub = yield this.js.subscribe(subj, copts);
            // by the time we are here, likely the subscription got messages
            if (fn) {
                const { info: { last } } = sub;
                // this doesn't sound correct - we should be looking for a seq number instead
                // then if we see a greater one, we are done.
                const expect = last.num_pending + last.delivered.consumer_seq;
                // if the iterator already queued - the only issue is other modifications
                // did happen like stream was pruned, and the ordered consumer reset, etc
                // we won't get what we are expecting - so the notification will never fire
                // the sentinel ought to be coming from the server
                if (expect === 0 || qi.received >= expect) {
                    try {
                        fn();
                    }
                    catch (err) {
                        // fail it - there's something wrong in the user callback
                        qi.stop(err);
                    }
                    finally {
                        fn = undefined;
                    }
                }
                else {
                    count = expect;
                }
            }
            qi._data = sub;
            qi.iterClosed.then(() => {
                sub.unsubscribe();
            });
            sub.closed.then(() => {
                qi.stop();
            }).catch((err) => {
                qi.stop(err);
            });
            return qi;
        });
    }
    canSetWatcherName() {
        const jsi = this.js;
        const nci = jsi.nc;
        const { ok } = nci.features.get(semver_1.Feature.JS_NEW_CONSUMER_CREATE_API);
        return ok;
    }
    watch() {
        return __awaiter(this, arguments, void 0, function* (opts = {}) {
            var _a;
            const k = (_a = opts.key) !== null && _a !== void 0 ? _a : ">";
            const qi = new queued_iterator_1.QueuedIteratorImpl();
            const co = {};
            co.headers_only = opts.headers_only || false;
            let content = types_1.KvWatchInclude.LastValue;
            if (opts.include === types_1.KvWatchInclude.AllHistory) {
                content = types_1.KvWatchInclude.AllHistory;
            }
            else if (opts.include === types_1.KvWatchInclude.UpdatesOnly) {
                content = types_1.KvWatchInclude.UpdatesOnly;
            }
            const ignoreDeletes = opts.ignoreDeletes === true;
            let fn = opts.initializedFn;
            let count = 0;
            const cc = this._buildCC(k, content, co);
            const subj = cc.filter_subject;
            const copts = (0, types_1.consumerOpts)(cc);
            if (this.canSetWatcherName()) {
                copts.consumerName(nuid_1.nuid.next());
            }
            copts.bindStream(this.stream);
            if (opts.resumeFromRevision && opts.resumeFromRevision > 0) {
                copts.startSequence(opts.resumeFromRevision);
            }
            copts.orderedConsumer();
            copts.callback((err, jm) => {
                if (err) {
                    // sub done
                    qi.stop(err);
                    return;
                }
                if (jm) {
                    const e = this.jmToEntry(jm);
                    if (ignoreDeletes && e.operation === "DEL") {
                        return;
                    }
                    qi.push(e);
                    qi.received++;
                    // count could have changed or has already been received
                    if (fn && (count > 0 && qi.received >= count || jm.info.pending === 0)) {
                        //@ts-ignore: we are injecting an unexpected type
                        qi.push(fn);
                        fn = undefined;
                    }
                }
            });
            const sub = yield this.js.subscribe(subj, copts);
            // by the time we are here, likely the subscription got messages
            if (fn) {
                const { info: { last } } = sub;
                // this doesn't sound correct - we should be looking for a seq number instead
                // then if we see a greater one, we are done.
                const expect = last.num_pending + last.delivered.consumer_seq;
                // if the iterator already queued - the only issue is other modifications
                // did happen like stream was pruned, and the ordered consumer reset, etc
                // we won't get what we are expecting - so the notification will never fire
                // the sentinel ought to be coming from the server
                if (expect === 0 || qi.received >= expect) {
                    try {
                        fn();
                    }
                    catch (err) {
                        // fail it - there's something wrong in the user callback
                        qi.stop(err);
                    }
                    finally {
                        fn = undefined;
                    }
                }
                else {
                    count = expect;
                }
            }
            qi._data = sub;
            qi.iterClosed.then(() => {
                sub.unsubscribe();
            });
            sub.closed.then(() => {
                qi.stop();
            }).catch((err) => {
                qi.stop(err);
            });
            return qi;
        });
    }
    keys() {
        return __awaiter(this, arguments, void 0, function* (k = ">") {
            const keys = new queued_iterator_1.QueuedIteratorImpl();
            const cc = this._buildCC(k, types_1.KvWatchInclude.LastValue, {
                headers_only: true,
            });
            const subj = Array.isArray(k) ? ">" : cc.filter_subject;
            const copts = (0, types_1.consumerOpts)(cc);
            copts.bindStream(this.stream);
            copts.orderedConsumer();
            const sub = yield this.js.subscribe(subj, copts);
            (() => __awaiter(this, void 0, void 0, function* () {
                var _a, e_3, _b, _c;
                var _d;
                try {
                    for (var _e = true, sub_1 = __asyncValues(sub), sub_1_1; sub_1_1 = yield sub_1.next(), _a = sub_1_1.done, !_a; _e = true) {
                        _c = sub_1_1.value;
                        _e = false;
                        const jm = _c;
                        const op = (_d = jm.headers) === null || _d === void 0 ? void 0 : _d.get(exports.kvOperationHdr);
                        if (op !== "DEL" && op !== "PURGE") {
                            const key = this.decodeKey(jm.subject.substring(this.prefixLen));
                            keys.push(key);
                        }
                        if (jm.info.pending === 0) {
                            sub.unsubscribe();
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (!_e && !_a && (_b = sub_1.return)) yield _b.call(sub_1);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }))()
                .then(() => {
                keys.stop();
            })
                .catch((err) => {
                keys.stop(err);
            });
            const si = sub;
            if (si.info.last.num_pending === 0) {
                sub.unsubscribe();
            }
            return keys;
        });
    }
    purgeBucket(opts) {
        return this.jsm.streams.purge(this.bucketName(), opts);
    }
    destroy() {
        return this.jsm.streams.delete(this.bucketName());
    }
    status() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const nc = this.js.nc;
            const cluster = (_b = (_a = nc.info) === null || _a === void 0 ? void 0 : _a.cluster) !== null && _b !== void 0 ? _b : "";
            const bn = this.bucketName();
            const si = yield this.jsm.streams.info(bn);
            return new KvStatusImpl(si, cluster);
        });
    }
}
exports.Bucket = Bucket;
class KvStatusImpl {
    constructor(si, cluster = "") {
        this.si = si;
        this.cluster = cluster;
    }
    get bucket() {
        return this.si.config.name.startsWith(types_1.kvPrefix)
            ? this.si.config.name.substring(types_1.kvPrefix.length)
            : this.si.config.name;
    }
    get values() {
        return this.si.state.messages;
    }
    get history() {
        return this.si.config.max_msgs_per_subject;
    }
    get ttl() {
        return (0, util_1.millis)(this.si.config.max_age);
    }
    get bucket_location() {
        return this.cluster;
    }
    get backingStore() {
        return this.si.config.storage;
    }
    get storage() {
        return this.si.config.storage;
    }
    get replicas() {
        return this.si.config.num_replicas;
    }
    get description() {
        var _a;
        return (_a = this.si.config.description) !== null && _a !== void 0 ? _a : "";
    }
    get maxBucketSize() {
        return this.si.config.max_bytes;
    }
    get maxValueSize() {
        return this.si.config.max_msg_size;
    }
    get max_bytes() {
        return this.si.config.max_bytes;
    }
    get placement() {
        return this.si.config.placement || { cluster: "", tags: [] };
    }
    get placementCluster() {
        var _a, _b;
        return (_b = (_a = this.si.config.placement) === null || _a === void 0 ? void 0 : _a.cluster) !== null && _b !== void 0 ? _b : "";
    }
    get republish() {
        var _a;
        return (_a = this.si.config.republish) !== null && _a !== void 0 ? _a : { src: "", dest: "" };
    }
    get streamInfo() {
        return this.si;
    }
    get size() {
        return this.si.state.bytes;
    }
    get metadata() {
        var _a;
        return (_a = this.si.config.metadata) !== null && _a !== void 0 ? _a : {};
    }
    get compression() {
        if (this.si.config.compression) {
            return this.si.config.compression !== jsapi_types_1.StoreCompression.None;
        }
        return false;
    }
}
exports.KvStatusImpl = KvStatusImpl;
class KvStoredEntryImpl {
    constructor(bucket, prefixLen, sm) {
        this.bucket = bucket;
        this.prefixLen = prefixLen;
        this.sm = sm;
    }
    get key() {
        return this.sm.subject.substring(this.prefixLen);
    }
    get value() {
        return this.sm.data;
    }
    get delta() {
        return 0;
    }
    get created() {
        return this.sm.time;
    }
    get revision() {
        return this.sm.seq;
    }
    get operation() {
        return this.sm.header.get(exports.kvOperationHdr) || "PUT";
    }
    get length() {
        const slen = this.sm.header.get(types_1.JsHeaders.MessageSizeHdr) || "";
        if (slen !== "") {
            return parseInt(slen, 10);
        }
        return this.sm.data.length;
    }
    json() {
        return this.sm.json();
    }
    string() {
        return this.sm.string();
    }
}
class KvJsMsgEntryImpl {
    constructor(bucket, key, sm) {
        this.bucket = bucket;
        this.key = key;
        this.sm = sm;
    }
    get value() {
        return this.sm.data;
    }
    get created() {
        return new Date((0, util_1.millis)(this.sm.info.timestampNanos));
    }
    get revision() {
        return this.sm.seq;
    }
    get operation() {
        var _a;
        return ((_a = this.sm.headers) === null || _a === void 0 ? void 0 : _a.get(exports.kvOperationHdr)) || "PUT";
    }
    get delta() {
        return this.sm.info.pending;
    }
    get length() {
        var _a;
        const slen = ((_a = this.sm.headers) === null || _a === void 0 ? void 0 : _a.get(types_1.JsHeaders.MessageSizeHdr)) || "";
        if (slen !== "") {
            return parseInt(slen, 10);
        }
        return this.sm.data.length;
    }
    json() {
        return this.sm.json();
    }
    string() {
        return this.sm.string();
    }
}
//# sourceMappingURL=kv.js.map