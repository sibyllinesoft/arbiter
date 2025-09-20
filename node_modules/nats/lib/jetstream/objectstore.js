"use strict";
/*
 * Copyright 2022-2025 The NATS Authors
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
exports.ObjectStoreImpl = exports.ObjectStoreStatusImpl = exports.digestType = exports.osPrefix = void 0;
exports.objectStoreStreamName = objectStoreStreamName;
exports.objectStoreBucketName = objectStoreBucketName;
const kv_1 = require("./kv");
const base64_1 = require("../nats-base-client/base64");
const codec_1 = require("../nats-base-client/codec");
const nuid_1 = require("../nats-base-client/nuid");
const util_1 = require("../nats-base-client/util");
const databuffer_1 = require("../nats-base-client/databuffer");
const headers_1 = require("../nats-base-client/headers");
const types_1 = require("./types");
const queued_iterator_1 = require("../nats-base-client/queued_iterator");
const js_sha256_1 = require("../nats-base-client/js-sha256");
const jsapi_types_1 = require("./jsapi_types");
const jsclient_1 = require("./jsclient");
const sha_digest_parser_1 = require("./sha_digest.parser");
exports.osPrefix = "OBJ_";
exports.digestType = "SHA-256=";
function objectStoreStreamName(bucket) {
    (0, kv_1.validateBucket)(bucket);
    return `${exports.osPrefix}${bucket}`;
}
function objectStoreBucketName(stream) {
    if (stream.startsWith(exports.osPrefix)) {
        return stream.substring(4);
    }
    return stream;
}
class ObjectStoreStatusImpl {
    constructor(si) {
        this.si = si;
        this.backingStore = "JetStream";
    }
    get bucket() {
        return objectStoreBucketName(this.si.config.name);
    }
    get description() {
        var _a;
        return (_a = this.si.config.description) !== null && _a !== void 0 ? _a : "";
    }
    get ttl() {
        return this.si.config.max_age;
    }
    get storage() {
        return this.si.config.storage;
    }
    get replicas() {
        return this.si.config.num_replicas;
    }
    get sealed() {
        return this.si.config.sealed;
    }
    get size() {
        return this.si.state.bytes;
    }
    get streamInfo() {
        return this.si;
    }
    get metadata() {
        return this.si.config.metadata;
    }
    get compression() {
        if (this.si.config.compression) {
            return this.si.config.compression !== jsapi_types_1.StoreCompression.None;
        }
        return false;
    }
}
exports.ObjectStoreStatusImpl = ObjectStoreStatusImpl;
class ObjectInfoImpl {
    constructor(oi) {
        this.info = oi;
    }
    get name() {
        return this.info.name;
    }
    get description() {
        var _a;
        return (_a = this.info.description) !== null && _a !== void 0 ? _a : "";
    }
    get headers() {
        if (!this.hdrs) {
            this.hdrs = headers_1.MsgHdrsImpl.fromRecord(this.info.headers || {});
        }
        return this.hdrs;
    }
    get options() {
        return this.info.options;
    }
    get bucket() {
        return this.info.bucket;
    }
    get chunks() {
        return this.info.chunks;
    }
    get deleted() {
        var _a;
        return (_a = this.info.deleted) !== null && _a !== void 0 ? _a : false;
    }
    get digest() {
        return this.info.digest;
    }
    get mtime() {
        return this.info.mtime;
    }
    get nuid() {
        return this.info.nuid;
    }
    get size() {
        return this.info.size;
    }
    get revision() {
        return this.info.revision;
    }
    get metadata() {
        return this.info.metadata || {};
    }
    isLink() {
        var _a, _b;
        return (((_a = this.info.options) === null || _a === void 0 ? void 0 : _a.link) !== undefined) &&
            (((_b = this.info.options) === null || _b === void 0 ? void 0 : _b.link) !== null);
    }
}
function toServerObjectStoreMeta(meta) {
    var _a;
    const v = {
        name: meta.name,
        description: (_a = meta.description) !== null && _a !== void 0 ? _a : "",
        options: meta.options,
        metadata: meta.metadata,
    };
    if (meta.headers) {
        const mhi = meta.headers;
        v.headers = mhi.toRecord();
    }
    return v;
}
function emptyReadableStream() {
    return new ReadableStream({
        pull(c) {
            c.enqueue(new Uint8Array(0));
            c.close();
        },
    });
}
class ObjectStoreImpl {
    constructor(name, jsm, js) {
        this.name = name;
        this.jsm = jsm;
        this.js = js;
    }
    _checkNotEmpty(name) {
        if (!name || name.length === 0) {
            return { name, error: new Error("name cannot be empty") };
        }
        return { name };
    }
    info(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = yield this.rawInfo(name);
            return info ? new ObjectInfoImpl(info) : null;
        });
    }
    list() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            const buf = [];
            const iter = yield this.watch({
                ignoreDeletes: true,
                includeHistory: true,
            });
            try {
                for (var _d = true, iter_1 = __asyncValues(iter), iter_1_1; iter_1_1 = yield iter_1.next(), _a = iter_1_1.done, !_a; _d = true) {
                    _c = iter_1_1.value;
                    _d = false;
                    const info = _c;
                    // watch will give a null when it has initialized
                    // for us that is the hint we are done
                    if (info === null) {
                        break;
                    }
                    buf.push(info);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = iter_1.return)) yield _b.call(iter_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return Promise.resolve(buf);
        });
    }
    rawInfo(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const { name: obj, error } = this._checkNotEmpty(name);
            if (error) {
                return Promise.reject(error);
            }
            const meta = this._metaSubject(obj);
            try {
                const m = yield this.jsm.streams.getMessage(this.stream, {
                    last_by_subj: meta,
                });
                const jc = (0, codec_1.JSONCodec)();
                const soi = jc.decode(m.data);
                soi.revision = m.seq;
                return soi;
            }
            catch (err) {
                if (err.code === "404") {
                    return null;
                }
                return Promise.reject(err);
            }
        });
    }
    _si(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.jsm.streams.info(this.stream, opts);
            }
            catch (err) {
                const nerr = err;
                if (nerr.code === "404") {
                    return null;
                }
                return Promise.reject(err);
            }
        });
    }
    seal() {
        return __awaiter(this, void 0, void 0, function* () {
            let info = yield this._si();
            if (info === null) {
                return Promise.reject(new Error("object store not found"));
            }
            info.config.sealed = true;
            info = yield this.jsm.streams.update(this.stream, info.config);
            return Promise.resolve(new ObjectStoreStatusImpl(info));
        });
    }
    status(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = yield this._si(opts);
            if (info === null) {
                return Promise.reject(new Error("object store not found"));
            }
            return Promise.resolve(new ObjectStoreStatusImpl(info));
        });
    }
    destroy() {
        return this.jsm.streams.delete(this.stream);
    }
    _put(meta, rs, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const jsopts = this.js.getOptions();
            opts = opts || { timeout: jsopts.timeout };
            opts.timeout = opts.timeout || jsopts.timeout;
            opts.previousRevision = (_a = opts.previousRevision) !== null && _a !== void 0 ? _a : undefined;
            const { timeout, previousRevision } = opts;
            const si = this.js.nc.info;
            const maxPayload = (si === null || si === void 0 ? void 0 : si.max_payload) || 1024;
            meta = meta || {};
            meta.options = meta.options || {};
            let maxChunk = ((_b = meta.options) === null || _b === void 0 ? void 0 : _b.max_chunk_size) || 128 * 1024;
            maxChunk = maxChunk > maxPayload ? maxPayload : maxChunk;
            meta.options.max_chunk_size = maxChunk;
            const old = yield this.info(meta.name);
            const { name: n, error } = this._checkNotEmpty(meta.name);
            if (error) {
                return Promise.reject(error);
            }
            const id = nuid_1.nuid.next();
            const chunkSubj = this._chunkSubject(id);
            const metaSubj = this._metaSubject(n);
            const info = Object.assign({
                bucket: this.name,
                nuid: id,
                size: 0,
                chunks: 0,
            }, toServerObjectStoreMeta(meta));
            const d = (0, util_1.deferred)();
            const proms = [];
            const db = new databuffer_1.DataBuffer();
            try {
                const reader = rs ? rs.getReader() : null;
                const sha = js_sha256_1.sha256.create();
                while (true) {
                    const { done, value } = reader
                        ? yield reader.read()
                        : { done: true, value: undefined };
                    if (done) {
                        // put any partial chunk in
                        if (db.size() > 0) {
                            const payload = db.drain();
                            sha.update(payload);
                            info.chunks++;
                            info.size += payload.length;
                            proms.push(this.js.publish(chunkSubj, payload, { timeout }));
                        }
                        // wait for all the chunks to write
                        yield Promise.all(proms);
                        proms.length = 0;
                        // prepare the metadata
                        info.mtime = new Date().toISOString();
                        const digest = base64_1.Base64UrlPaddedCodec.encode(sha.digest());
                        info.digest = `${exports.digestType}${digest}`;
                        info.deleted = false;
                        // trailing md for the object
                        const h = (0, headers_1.headers)();
                        if (typeof previousRevision === "number") {
                            h.set(jsclient_1.PubHeaders.ExpectedLastSubjectSequenceHdr, `${previousRevision}`);
                        }
                        h.set(types_1.JsHeaders.RollupHdr, types_1.JsHeaders.RollupValueSubject);
                        // try to update the metadata
                        const pa = yield this.js.publish(metaSubj, (0, codec_1.JSONCodec)().encode(info), {
                            headers: h,
                            timeout,
                        });
                        // update the revision to point to the sequence where we inserted
                        info.revision = pa.seq;
                        // if we are here, the new entry is live
                        if (old) {
                            try {
                                yield this.jsm.streams.purge(this.stream, {
                                    filter: `$O.${this.name}.C.${old.nuid}`,
                                });
                            }
                            catch (_err) {
                                // rejecting here, would mean send the wrong signal
                                // the update succeeded, but cleanup of old chunks failed.
                            }
                        }
                        // resolve the ObjectInfo
                        d.resolve(new ObjectInfoImpl(info));
                        // stop
                        break;
                    }
                    if (value) {
                        db.fill(value);
                        while (db.size() > maxChunk) {
                            info.chunks++;
                            info.size += maxChunk;
                            const payload = db.drain(meta.options.max_chunk_size);
                            sha.update(payload);
                            proms.push(this.js.publish(chunkSubj, payload, { timeout }));
                        }
                    }
                }
            }
            catch (err) {
                // we failed, remove any partials
                yield this.jsm.streams.purge(this.stream, { filter: chunkSubj });
                d.reject(err);
            }
            return d;
        });
    }
    putBlob(meta, data, opts) {
        function readableStreamFrom(data) {
            return new ReadableStream({
                pull(controller) {
                    controller.enqueue(data);
                    controller.close();
                },
            });
        }
        if (data === null) {
            data = new Uint8Array(0);
        }
        return this.put(meta, readableStreamFrom(data), opts);
    }
    put(meta, rs, opts) {
        var _a;
        if ((_a = meta === null || meta === void 0 ? void 0 : meta.options) === null || _a === void 0 ? void 0 : _a.link) {
            return Promise.reject(new Error("link cannot be set when putting the object in bucket"));
        }
        return this._put(meta, rs, opts);
    }
    getBlob(name) {
        return __awaiter(this, void 0, void 0, function* () {
            function fromReadableStream(rs) {
                return __awaiter(this, void 0, void 0, function* () {
                    const buf = new databuffer_1.DataBuffer();
                    const reader = rs.getReader();
                    while (true) {
                        const { done, value } = yield reader.read();
                        if (done) {
                            return buf.drain();
                        }
                        if (value && value.length) {
                            buf.fill(value);
                        }
                    }
                });
            }
            const r = yield this.get(name);
            if (r === null) {
                return Promise.resolve(null);
            }
            const vs = yield Promise.all([r.error, fromReadableStream(r.data)]);
            if (vs[0]) {
                return Promise.reject(vs[0]);
            }
            else {
                return Promise.resolve(vs[1]);
            }
        });
    }
    get(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = yield this.rawInfo(name);
            if (info === null) {
                return Promise.resolve(null);
            }
            if (info.deleted) {
                return Promise.resolve(null);
            }
            if (info.options && info.options.link) {
                const ln = info.options.link.name || "";
                if (ln === "") {
                    throw new Error("link is a bucket");
                }
                const os = info.options.link.bucket !== this.name
                    ? yield ObjectStoreImpl.create(this.js, info.options.link.bucket)
                    : this;
                return os.get(ln);
            }
            if (!info.digest.startsWith(exports.digestType)) {
                return Promise.reject(new Error(`unknown digest type: ${info.digest}`));
            }
            const digest = (0, sha_digest_parser_1.parseSha256)(info.digest.substring(8));
            if (digest === null) {
                return Promise.reject(new Error(`unable to parse digest: ${info.digest}`));
            }
            const d = (0, util_1.deferred)();
            const r = {
                info: new ObjectInfoImpl(info),
                error: d,
            };
            if (info.size === 0) {
                r.data = emptyReadableStream();
                d.resolve(null);
                return Promise.resolve(r);
            }
            let controller;
            const oc = (0, types_1.consumerOpts)();
            oc.orderedConsumer();
            const sha = js_sha256_1.sha256.create();
            const subj = `$O.${this.name}.C.${info.nuid}`;
            const sub = yield this.js.subscribe(subj, oc);
            (() => __awaiter(this, void 0, void 0, function* () {
                var _a, e_2, _b, _c;
                try {
                    for (var _d = true, sub_1 = __asyncValues(sub), sub_1_1; sub_1_1 = yield sub_1.next(), _a = sub_1_1.done, !_a; _d = true) {
                        _c = sub_1_1.value;
                        _d = false;
                        const jm = _c;
                        if (jm.data.length > 0) {
                            sha.update(jm.data);
                            controller.enqueue(jm.data);
                        }
                        if (jm.info.pending === 0) {
                            if (!(0, sha_digest_parser_1.checkSha256)(digest, sha.digest())) {
                                controller.error(new Error(`received a corrupt object, digests do not match received: ${info.digest} calculated ${digest}`));
                            }
                            else {
                                controller.close();
                            }
                            sub.unsubscribe();
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = sub_1.return)) yield _b.call(sub_1);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }))()
                .then(() => {
                d.resolve();
            })
                .catch((err) => {
                controller.error(err);
                d.reject(err);
            });
            r.data = new ReadableStream({
                start(c) {
                    controller = c;
                },
                cancel() {
                    sub.unsubscribe();
                },
            });
            return r;
        });
    }
    linkStore(name, bucket) {
        if (!(bucket instanceof ObjectStoreImpl)) {
            return Promise.reject("bucket required");
        }
        const osi = bucket;
        const { name: n, error } = this._checkNotEmpty(name);
        if (error) {
            return Promise.reject(error);
        }
        const meta = {
            name: n,
            options: { link: { bucket: osi.name } },
        };
        return this._put(meta, null);
    }
    link(name, info) {
        return __awaiter(this, void 0, void 0, function* () {
            const { name: n, error } = this._checkNotEmpty(name);
            if (error) {
                return Promise.reject(error);
            }
            if (info.deleted) {
                return Promise.reject(new Error("src object is deleted"));
            }
            if (info.isLink()) {
                return Promise.reject(new Error("src object is a link"));
            }
            const dest = yield this.rawInfo(name);
            if (dest !== null && !dest.deleted) {
                return Promise.reject(new Error("an object already exists with that name"));
            }
            const link = { bucket: info.bucket, name: info.name };
            const mm = {
                name: n,
                bucket: info.bucket,
                options: { link: link },
            };
            yield this.js.publish(this._metaSubject(name), JSON.stringify(mm));
            const i = yield this.info(name);
            return Promise.resolve(i);
        });
    }
    delete(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = yield this.rawInfo(name);
            if (info === null) {
                return Promise.resolve({ purged: 0, success: false });
            }
            info.deleted = true;
            info.size = 0;
            info.chunks = 0;
            info.digest = "";
            const jc = (0, codec_1.JSONCodec)();
            const h = (0, headers_1.headers)();
            h.set(types_1.JsHeaders.RollupHdr, types_1.JsHeaders.RollupValueSubject);
            yield this.js.publish(this._metaSubject(info.name), jc.encode(info), {
                headers: h,
            });
            return this.jsm.streams.purge(this.stream, {
                filter: this._chunkSubject(info.nuid),
            });
        });
    }
    update(name_1) {
        return __awaiter(this, arguments, void 0, function* (name, meta = {}) {
            var _a;
            const info = yield this.rawInfo(name);
            if (info === null) {
                return Promise.reject(new Error("object not found"));
            }
            if (info.deleted) {
                return Promise.reject(new Error("cannot update meta for a deleted object"));
            }
            meta.name = (_a = meta.name) !== null && _a !== void 0 ? _a : info.name;
            const { name: n, error } = this._checkNotEmpty(meta.name);
            if (error) {
                return Promise.reject(error);
            }
            if (name !== meta.name) {
                const i = yield this.info(meta.name);
                if (i && !i.deleted) {
                    return Promise.reject(new Error("an object already exists with that name"));
                }
            }
            meta.name = n;
            const ii = Object.assign({}, info, toServerObjectStoreMeta(meta));
            // if the name changed, delete the old meta
            const ack = yield this.js.publish(this._metaSubject(ii.name), JSON.stringify(ii));
            if (name !== meta.name) {
                yield this.jsm.streams.purge(this.stream, {
                    filter: this._metaSubject(name),
                });
            }
            return Promise.resolve(ack);
        });
    }
    watch() {
        return __awaiter(this, arguments, void 0, function* (opts = {}) {
            var _a, _b;
            opts.includeHistory = (_a = opts.includeHistory) !== null && _a !== void 0 ? _a : false;
            opts.ignoreDeletes = (_b = opts.ignoreDeletes) !== null && _b !== void 0 ? _b : false;
            let initialized = false;
            const qi = new queued_iterator_1.QueuedIteratorImpl();
            const subj = this._metaSubjectAll();
            try {
                yield this.jsm.streams.getMessage(this.stream, { last_by_subj: subj });
            }
            catch (err) {
                if (err.code === "404") {
                    qi.push(null);
                    initialized = true;
                }
                else {
                    qi.stop(err);
                }
            }
            const jc = (0, codec_1.JSONCodec)();
            const copts = (0, types_1.consumerOpts)();
            copts.orderedConsumer();
            if (opts.includeHistory) {
                copts.deliverLastPerSubject();
            }
            else {
                // FIXME: Go's implementation doesn't seem correct - if history is not desired
                //  the watch should only be giving notifications on new entries
                initialized = true;
                copts.deliverNew();
            }
            copts.callback((err, jm) => {
                var _a;
                if (err) {
                    qi.stop(err);
                    return;
                }
                if (jm !== null) {
                    const oi = jc.decode(jm.data);
                    if (oi.deleted && opts.ignoreDeletes === true) {
                        // do nothing
                    }
                    else {
                        qi.push(oi);
                    }
                    if (((_a = jm.info) === null || _a === void 0 ? void 0 : _a.pending) === 0 && !initialized) {
                        initialized = true;
                        qi.push(null);
                    }
                }
            });
            const sub = yield this.js.subscribe(subj, copts);
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
    _chunkSubject(id) {
        return `$O.${this.name}.C.${id}`;
    }
    _metaSubject(n) {
        return `$O.${this.name}.M.${base64_1.Base64UrlPaddedCodec.encode(n)}`;
    }
    _metaSubjectAll() {
        return `$O.${this.name}.M.>`;
    }
    init() {
        return __awaiter(this, arguments, void 0, function* (opts = {}) {
            var _a;
            try {
                this.stream = objectStoreStreamName(this.name);
            }
            catch (err) {
                return Promise.reject(err);
            }
            const max_age = (opts === null || opts === void 0 ? void 0 : opts.ttl) || 0;
            delete opts.ttl;
            // pacify the tsc compiler downstream
            const sc = Object.assign({ max_age }, opts);
            sc.name = this.stream;
            sc.num_replicas = (_a = opts.replicas) !== null && _a !== void 0 ? _a : 1;
            sc.allow_direct = true;
            sc.allow_rollup_hdrs = true;
            sc.discard = jsapi_types_1.DiscardPolicy.New;
            sc.subjects = [`$O.${this.name}.C.>`, `$O.${this.name}.M.>`];
            if (opts.placement) {
                sc.placement = opts.placement;
            }
            if (opts.metadata) {
                sc.metadata = opts.metadata;
            }
            if (typeof opts.compression === "boolean") {
                sc.compression = opts.compression
                    ? jsapi_types_1.StoreCompression.S2
                    : jsapi_types_1.StoreCompression.None;
            }
            try {
                yield this.jsm.streams.info(sc.name);
            }
            catch (err) {
                if (err.message === "stream not found") {
                    yield this.jsm.streams.add(sc);
                }
            }
        });
    }
    static create(js_1, name_1) {
        return __awaiter(this, arguments, void 0, function* (js, name, opts = {}) {
            const jsm = yield js.jetstreamManager();
            const os = new ObjectStoreImpl(name, jsm, js);
            yield os.init(opts);
            return Promise.resolve(os);
        });
    }
}
exports.ObjectStoreImpl = ObjectStoreImpl;
//# sourceMappingURL=objectstore.js.map