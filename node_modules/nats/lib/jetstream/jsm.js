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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JetStreamManagerImpl = exports.DirectMsgImpl = exports.DirectStreamAPIImpl = void 0;
const jsbaseclient_api_1 = require("./jsbaseclient_api");
const jsmstream_api_1 = require("./jsmstream_api");
const jsmconsumer_api_1 = require("./jsmconsumer_api");
const queued_iterator_1 = require("../nats-base-client/queued_iterator");
const types_1 = require("./types");
const core_1 = require("../nats-base-client/core");
const jsutil_1 = require("./jsutil");
const encoders_1 = require("../nats-base-client/encoders");
const codec_1 = require("../nats-base-client/codec");
class DirectStreamAPIImpl extends jsbaseclient_api_1.BaseApiClient {
    constructor(nc, opts) {
        super(nc, opts);
    }
    getMessage(stream, query) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(stream);
            // if doing a last_by_subj request, we append the subject
            // this allows last_by_subj to be subject to permissions (KV)
            let qq = query;
            const { last_by_subj } = qq;
            if (last_by_subj) {
                qq = null;
            }
            const payload = qq ? this.jc.encode(qq) : encoders_1.Empty;
            const pre = this.opts.apiPrefix || "$JS.API";
            const subj = last_by_subj
                ? `${pre}.DIRECT.GET.${stream}.${last_by_subj}`
                : `${pre}.DIRECT.GET.${stream}`;
            const r = yield this.nc.request(subj, payload, { timeout: this.timeout });
            // response is not a JS.API response
            const err = (0, jsutil_1.checkJsError)(r);
            if (err) {
                return Promise.reject(err);
            }
            const dm = new DirectMsgImpl(r);
            return Promise.resolve(dm);
        });
    }
    getBatch(stream, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(stream);
            const pre = this.opts.apiPrefix || "$JS.API";
            const subj = `${pre}.DIRECT.GET.${stream}`;
            if (!Array.isArray(opts.multi_last) || opts.multi_last.length === 0) {
                return Promise.reject("multi_last is required");
            }
            const payload = JSON.stringify(opts, (key, value) => {
                if (key === "up_to_time" && value instanceof Date) {
                    return value.toISOString();
                }
                return value;
            });
            const iter = new queued_iterator_1.QueuedIteratorImpl();
            const raw = yield this.nc.requestMany(subj, payload, {
                strategy: core_1.RequestStrategy.SentinelMsg,
            });
            (() => __awaiter(this, void 0, void 0, function* () {
                var _a, e_1, _b, _c;
                var _d, _e, _f;
                let gotFirst = false;
                let badServer = false;
                let badRequest;
                try {
                    for (var _g = true, raw_1 = __asyncValues(raw), raw_1_1; raw_1_1 = yield raw_1.next(), _a = raw_1_1.done, !_a; _g = true) {
                        _c = raw_1_1.value;
                        _g = false;
                        const m = _c;
                        if (!gotFirst) {
                            gotFirst = true;
                            const code = ((_d = m.headers) === null || _d === void 0 ? void 0 : _d.code) || 0;
                            if (code !== 0 && code < 200 || code > 299) {
                                badRequest = (_e = m.headers) === null || _e === void 0 ? void 0 : _e.description.toLowerCase();
                                break;
                            }
                            // inspect the message and make sure that we have a supported server
                            const v = (_f = m.headers) === null || _f === void 0 ? void 0 : _f.get("Nats-Num-Pending");
                            if (v === "") {
                                badServer = true;
                                break;
                            }
                        }
                        if (m.data.length === 0) {
                            break;
                        }
                        iter.push(new DirectMsgImpl(m));
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_g && !_a && (_b = raw_1.return)) yield _b.call(raw_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                //@ts-ignore: term function
                iter.push(() => {
                    if (badServer) {
                        throw new Error("batch direct get not supported by the server");
                    }
                    if (badRequest) {
                        throw new Error(`bad request: ${badRequest}`);
                    }
                    iter.stop();
                });
            }))();
            return Promise.resolve(iter);
        });
    }
}
exports.DirectStreamAPIImpl = DirectStreamAPIImpl;
class DirectMsgImpl {
    constructor(m) {
        if (!m.headers) {
            throw new Error("headers expected");
        }
        this.data = m.data;
        this.header = m.headers;
    }
    get subject() {
        return this.header.last(types_1.DirectMsgHeaders.Subject);
    }
    get seq() {
        const v = this.header.last(types_1.DirectMsgHeaders.Sequence);
        return typeof v === "string" ? parseInt(v) : 0;
    }
    get time() {
        return new Date(Date.parse(this.timestamp));
    }
    get timestamp() {
        return this.header.last(types_1.DirectMsgHeaders.TimeStamp);
    }
    get stream() {
        return this.header.last(types_1.DirectMsgHeaders.Stream);
    }
    json(reviver) {
        return (0, codec_1.JSONCodec)(reviver).decode(this.data);
    }
    string() {
        return encoders_1.TD.decode(this.data);
    }
}
exports.DirectMsgImpl = DirectMsgImpl;
class JetStreamManagerImpl extends jsbaseclient_api_1.BaseApiClient {
    constructor(nc, opts) {
        super(nc, opts);
        this.streams = new jsmstream_api_1.StreamAPIImpl(nc, opts);
        this.consumers = new jsmconsumer_api_1.ConsumerAPIImpl(nc, opts);
        this.direct = new DirectStreamAPIImpl(nc, opts);
    }
    getAccountInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const r = yield this._request(`${this.prefix}.INFO`);
            return r;
        });
    }
    jetstream() {
        return this.nc.jetstream(this.getOptions());
    }
    advisories() {
        const iter = new queued_iterator_1.QueuedIteratorImpl();
        this.nc.subscribe(`$JS.EVENT.ADVISORY.>`, {
            callback: (err, msg) => {
                if (err) {
                    throw err;
                }
                try {
                    const d = this.parseJsResponse(msg);
                    const chunks = d.type.split(".");
                    const kind = chunks[chunks.length - 1];
                    iter.push({ kind: kind, data: d });
                }
                catch (err) {
                    iter.stop(err);
                }
            },
        });
        return iter;
    }
}
exports.JetStreamManagerImpl = JetStreamManagerImpl;
//# sourceMappingURL=jsm.js.map