"use strict";
/*
 * Copyright 2021-2023 The NATS Authors
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamsImpl = exports.StoredMsgImpl = exports.StreamAPIImpl = exports.StreamImpl = exports.ConsumersImpl = void 0;
exports.convertStreamSourceDomain = convertStreamSourceDomain;
const types_1 = require("../nats-base-client/types");
const jsbaseclient_api_1 = require("./jsbaseclient_api");
const jslister_1 = require("./jslister");
const jsutil_1 = require("./jsutil");
const headers_1 = require("../nats-base-client/headers");
const kv_1 = require("./kv");
const objectstore_1 = require("./objectstore");
const codec_1 = require("../nats-base-client/codec");
const encoders_1 = require("../nats-base-client/encoders");
const semver_1 = require("../nats-base-client/semver");
const types_2 = require("./types");
const consumer_1 = require("./consumer");
const jsmconsumer_api_1 = require("./jsmconsumer_api");
function convertStreamSourceDomain(s) {
    if (s === undefined) {
        return undefined;
    }
    const { domain } = s;
    if (domain === undefined) {
        return s;
    }
    const copy = Object.assign({}, s);
    delete copy.domain;
    if (domain === "") {
        return copy;
    }
    if (copy.external) {
        throw new Error("domain and external are both set");
    }
    copy.external = { api: `$JS.${domain}.API` };
    return copy;
}
class ConsumersImpl {
    constructor(api) {
        this.api = api;
        this.notified = false;
    }
    checkVersion() {
        const fv = this.api.nc.features.get(semver_1.Feature.JS_SIMPLIFICATION);
        if (!fv.ok) {
            return Promise.reject(new Error(`consumers framework is only supported on servers ${fv.min} or better`));
        }
        return Promise.resolve();
    }
    getPullConsumerFor(ci) {
        if (ci.config.deliver_subject !== undefined) {
            throw new Error("push consumer not supported");
        }
        return new consumer_1.PullConsumerImpl(this.api, ci);
    }
    get(stream_1) {
        return __awaiter(this, arguments, void 0, function* (stream, name = {}) {
            if (typeof name === "object") {
                return this.ordered(stream, name);
            }
            // check we have support for pending msgs and header notifications
            yield this.checkVersion();
            return this.api.info(stream, name)
                .then((ci) => {
                if (ci.config.deliver_subject !== undefined) {
                    return Promise.reject(new Error("push consumer not supported"));
                }
                return new consumer_1.PullConsumerImpl(this.api, ci);
            })
                .catch((err) => {
                return Promise.reject(err);
            });
        });
    }
    ordered(stream, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.checkVersion();
            const impl = this.api;
            const sapi = new StreamAPIImpl(impl.nc, impl.opts);
            return sapi.info(stream)
                .then((_si) => {
                return Promise.resolve(new consumer_1.OrderedPullConsumerImpl(this.api, stream, opts));
            })
                .catch((err) => {
                return Promise.reject(err);
            });
        });
    }
}
exports.ConsumersImpl = ConsumersImpl;
class StreamImpl {
    constructor(api, info) {
        this.api = api;
        this._info = info;
    }
    get name() {
        return this._info.config.name;
    }
    alternates() {
        return this.info()
            .then((si) => {
            return si.alternates ? si.alternates : [];
        });
    }
    best() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.info();
            if (this._info.alternates) {
                const asi = yield this.api.info(this._info.alternates[0].name);
                return new StreamImpl(this.api, asi);
            }
            else {
                return this;
            }
        });
    }
    info(cached = false, opts) {
        if (cached) {
            return Promise.resolve(this._info);
        }
        return this.api.info(this.name, opts)
            .then((si) => {
            this._info = si;
            return this._info;
        });
    }
    getConsumerFromInfo(ci) {
        return new ConsumersImpl(new jsmconsumer_api_1.ConsumerAPIImpl(this.api.nc, this.api.opts))
            .getPullConsumerFor(ci);
    }
    getConsumer(name) {
        return new ConsumersImpl(new jsmconsumer_api_1.ConsumerAPIImpl(this.api.nc, this.api.opts))
            .get(this.name, name);
    }
    getMessage(query) {
        return this.api.getMessage(this.name, query);
    }
    deleteMessage(seq, erase) {
        return this.api.deleteMessage(this.name, seq, erase);
    }
}
exports.StreamImpl = StreamImpl;
class StreamAPIImpl extends jsbaseclient_api_1.BaseApiClient {
    constructor(nc, opts) {
        super(nc, opts);
    }
    checkStreamConfigVersions(cfg) {
        const nci = this.nc;
        if (cfg.metadata) {
            const { min, ok } = nci.features.get(semver_1.Feature.JS_STREAM_CONSUMER_METADATA);
            if (!ok) {
                throw new Error(`stream 'metadata' requires server ${min}`);
            }
        }
        if (cfg.first_seq) {
            const { min, ok } = nci.features.get(semver_1.Feature.JS_STREAM_FIRST_SEQ);
            if (!ok) {
                throw new Error(`stream 'first_seq' requires server ${min}`);
            }
        }
        if (cfg.subject_transform) {
            const { min, ok } = nci.features.get(semver_1.Feature.JS_STREAM_SUBJECT_TRANSFORM);
            if (!ok) {
                throw new Error(`stream 'subject_transform' requires server ${min}`);
            }
        }
        if (cfg.compression) {
            const { min, ok } = nci.features.get(semver_1.Feature.JS_STREAM_COMPRESSION);
            if (!ok) {
                throw new Error(`stream 'compression' requires server ${min}`);
            }
        }
        if (cfg.consumer_limits) {
            const { min, ok } = nci.features.get(semver_1.Feature.JS_DEFAULT_CONSUMER_LIMITS);
            if (!ok) {
                throw new Error(`stream 'consumer_limits' requires server ${min}`);
            }
        }
        function validateStreamSource(context, src) {
            var _a;
            const count = ((_a = src === null || src === void 0 ? void 0 : src.subject_transforms) === null || _a === void 0 ? void 0 : _a.length) || 0;
            if (count > 0) {
                const { min, ok } = nci.features.get(semver_1.Feature.JS_STREAM_SOURCE_SUBJECT_TRANSFORM);
                if (!ok) {
                    throw new Error(`${context} 'subject_transforms' requires server ${min}`);
                }
            }
        }
        if (cfg.sources) {
            cfg.sources.forEach((src) => {
                validateStreamSource("stream sources", src);
            });
        }
        if (cfg.mirror) {
            validateStreamSource("stream mirror", cfg.mirror);
        }
    }
    add() {
        return __awaiter(this, arguments, void 0, function* (cfg = {}) {
            var _a;
            this.checkStreamConfigVersions(cfg);
            (0, jsutil_1.validateStreamName)(cfg.name);
            cfg.mirror = convertStreamSourceDomain(cfg.mirror);
            //@ts-ignore: the sources are either set or not - so no item should be undefined in the list
            cfg.sources = (_a = cfg.sources) === null || _a === void 0 ? void 0 : _a.map(convertStreamSourceDomain);
            const r = yield this._request(`${this.prefix}.STREAM.CREATE.${cfg.name}`, cfg);
            const si = r;
            this._fixInfo(si);
            return si;
        });
    }
    delete(stream) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(stream);
            const r = yield this._request(`${this.prefix}.STREAM.DELETE.${stream}`);
            const cr = r;
            return cr.success;
        });
    }
    update(name_1) {
        return __awaiter(this, arguments, void 0, function* (name, cfg = {}) {
            var _a;
            if (typeof name === "object") {
                const sc = name;
                name = sc.name;
                cfg = sc;
                console.trace(`\u001B[33m >> streams.update(config: StreamConfig) api changed to streams.update(name: string, config: StreamUpdateConfig) - this shim will be removed - update your code.  \u001B[0m`);
            }
            this.checkStreamConfigVersions(cfg);
            (0, jsutil_1.validateStreamName)(name);
            const old = yield this.info(name);
            const update = Object.assign(old.config, cfg);
            update.mirror = convertStreamSourceDomain(update.mirror);
            //@ts-ignore: the sources are either set or not - so no item should be undefined in the list
            update.sources = (_a = update.sources) === null || _a === void 0 ? void 0 : _a.map(convertStreamSourceDomain);
            const r = yield this._request(`${this.prefix}.STREAM.UPDATE.${name}`, update);
            const si = r;
            this._fixInfo(si);
            return si;
        });
    }
    info(name, data) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(name);
            const subj = `${this.prefix}.STREAM.INFO.${name}`;
            const r = yield this._request(subj, data);
            let si = r;
            let { total, limit } = si;
            // check how many subjects we got in the first request
            let have = si.state.subjects
                ? Object.getOwnPropertyNames(si.state.subjects).length
                : 1;
            // if the response is paged, we have a large list of subjects
            // handle the paging and return a StreamInfo with all of it
            if (total && total > have) {
                const infos = [si];
                const paged = data || {};
                let i = 0;
                // total could change, so it is possible to have collected
                // more that the total
                while (total > have) {
                    i++;
                    paged.offset = limit * i;
                    const r = yield this._request(subj, paged);
                    // update it in case it changed
                    total = r.total;
                    infos.push(r);
                    const count = Object.getOwnPropertyNames(r.state.subjects).length;
                    have += count;
                    // if request returns less than limit it is done
                    if (count < limit) {
                        // done
                        break;
                    }
                }
                // collect all the subjects
                let subjects = {};
                for (let i = 0; i < infos.length; i++) {
                    si = infos[i];
                    if (si.state.subjects) {
                        subjects = Object.assign(subjects, si.state.subjects);
                    }
                }
                // don't give the impression we paged
                si.offset = 0;
                si.total = 0;
                si.limit = 0;
                si.state.subjects = subjects;
            }
            this._fixInfo(si);
            return si;
        });
    }
    list(subject = "") {
        const payload = (subject === null || subject === void 0 ? void 0 : subject.length) ? { subject } : {};
        const listerFilter = (v) => {
            const slr = v;
            slr.streams.forEach((si) => {
                this._fixInfo(si);
            });
            return slr.streams;
        };
        const subj = `${this.prefix}.STREAM.LIST`;
        return new jslister_1.ListerImpl(subj, listerFilter, this, payload);
    }
    // FIXME: init of sealed, deny_delete, deny_purge shouldn't be necessary
    //  https://github.com/nats-io/nats-server/issues/2633
    _fixInfo(si) {
        si.config.sealed = si.config.sealed || false;
        si.config.deny_delete = si.config.deny_delete || false;
        si.config.deny_purge = si.config.deny_purge || false;
        si.config.allow_rollup_hdrs = si.config.allow_rollup_hdrs || false;
    }
    purge(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (opts) {
                const { keep, seq } = opts;
                if (typeof keep === "number" && typeof seq === "number") {
                    throw new Error("can specify one of keep or seq");
                }
            }
            (0, jsutil_1.validateStreamName)(name);
            const v = yield this._request(`${this.prefix}.STREAM.PURGE.${name}`, opts);
            return v;
        });
    }
    deleteMessage(stream_1, seq_1) {
        return __awaiter(this, arguments, void 0, function* (stream, seq, erase = true) {
            (0, jsutil_1.validateStreamName)(stream);
            const dr = { seq };
            if (!erase) {
                dr.no_erase = true;
            }
            const r = yield this._request(`${this.prefix}.STREAM.MSG.DELETE.${stream}`, dr);
            const cr = r;
            return cr.success;
        });
    }
    getMessage(stream, query) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(stream);
            const r = yield this._request(`${this.prefix}.STREAM.MSG.GET.${stream}`, query);
            const sm = r;
            return new StoredMsgImpl(sm);
        });
    }
    find(subject) {
        return this.findStream(subject);
    }
    listKvs() {
        const filter = (v) => {
            var _a, _b;
            const slr = v;
            const kvStreams = slr.streams.filter((v) => {
                return v.config.name.startsWith(types_2.kvPrefix);
            });
            kvStreams.forEach((si) => {
                this._fixInfo(si);
            });
            let cluster = "";
            if (kvStreams.length) {
                cluster = (_b = (_a = this.nc.info) === null || _a === void 0 ? void 0 : _a.cluster) !== null && _b !== void 0 ? _b : "";
            }
            const status = kvStreams.map((si) => {
                return new kv_1.KvStatusImpl(si, cluster);
            });
            return status;
        };
        const subj = `${this.prefix}.STREAM.LIST`;
        return new jslister_1.ListerImpl(subj, filter, this);
    }
    listObjectStores() {
        const filter = (v) => {
            const slr = v;
            const objStreams = slr.streams.filter((v) => {
                return v.config.name.startsWith(objectstore_1.osPrefix);
            });
            objStreams.forEach((si) => {
                this._fixInfo(si);
            });
            const status = objStreams.map((si) => {
                return new objectstore_1.ObjectStoreStatusImpl(si);
            });
            return status;
        };
        const subj = `${this.prefix}.STREAM.LIST`;
        return new jslister_1.ListerImpl(subj, filter, this);
    }
    names(subject = "") {
        const payload = (subject === null || subject === void 0 ? void 0 : subject.length) ? { subject } : {};
        const listerFilter = (v) => {
            const sr = v;
            return sr.streams;
        };
        const subj = `${this.prefix}.STREAM.NAMES`;
        return new jslister_1.ListerImpl(subj, listerFilter, this, payload);
    }
    get(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const si = yield this.info(name);
            return Promise.resolve(new StreamImpl(this, si));
        });
    }
}
exports.StreamAPIImpl = StreamAPIImpl;
class StoredMsgImpl {
    constructor(smr) {
        this.smr = smr;
    }
    get subject() {
        return this.smr.message.subject;
    }
    get seq() {
        return this.smr.message.seq;
    }
    get timestamp() {
        return this.smr.message.time;
    }
    get time() {
        return new Date(Date.parse(this.timestamp));
    }
    get data() {
        return this.smr.message.data ? this._parse(this.smr.message.data) : types_1.Empty;
    }
    get header() {
        if (!this._header) {
            if (this.smr.message.hdrs) {
                const hd = this._parse(this.smr.message.hdrs);
                this._header = headers_1.MsgHdrsImpl.decode(hd);
            }
            else {
                this._header = (0, headers_1.headers)();
            }
        }
        return this._header;
    }
    _parse(s) {
        const bs = atob(s);
        const len = bs.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = bs.charCodeAt(i);
        }
        return bytes;
    }
    json(reviver) {
        return (0, codec_1.JSONCodec)(reviver).decode(this.data);
    }
    string() {
        return encoders_1.TD.decode(this.data);
    }
}
exports.StoredMsgImpl = StoredMsgImpl;
class StreamsImpl {
    constructor(api) {
        this.api = api;
    }
    get(stream) {
        return this.api.info(stream)
            .then((si) => {
            return new StreamImpl(this.api, si);
        });
    }
}
exports.StreamsImpl = StreamsImpl;
//# sourceMappingURL=jsmstream_api.js.map