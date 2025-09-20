"use strict";
/*
 * Copyright 2020-2022 The NATS Authors
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
exports.Bench = exports.Metric = void 0;
exports.throughput = throughput;
exports.msgThroughput = msgThroughput;
exports.humanizeBytes = humanizeBytes;
const types_1 = require("./types");
const nuid_1 = require("./nuid");
const util_1 = require("./util");
const core_1 = require("./core");
class Metric {
    constructor(name, duration) {
        this.name = name;
        this.duration = duration;
        this.date = Date.now();
        this.payload = 0;
        this.msgs = 0;
        this.bytes = 0;
    }
    toString() {
        const sec = (this.duration) / 1000;
        const mps = Math.round(this.msgs / sec);
        const label = this.asyncRequests ? "asyncRequests" : "";
        let minmax = "";
        if (this.max) {
            minmax = `${this.min}/${this.max}`;
        }
        return `${this.name}${label ? " [asyncRequests]" : ""} ${humanizeNumber(mps)} msgs/sec - [${sec.toFixed(2)} secs] ~ ${throughput(this.bytes, sec)} ${minmax}`;
    }
    toCsv() {
        return `"${this.name}",${new Date(this.date).toISOString()},${this.lang},${this.version},${this.msgs},${this.payload},${this.bytes},${this.duration},${this.asyncRequests ? this.asyncRequests : false}\n`;
    }
    static header() {
        return `Test,Date,Lang,Version,Count,MsgPayload,Bytes,Millis,Async\n`;
    }
}
exports.Metric = Metric;
class Bench {
    constructor(nc, opts = {
        msgs: 100000,
        size: 128,
        subject: "",
        asyncRequests: false,
        pub: false,
        sub: false,
        req: false,
        rep: false,
    }) {
        this.nc = nc;
        this.callbacks = opts.callbacks || false;
        this.msgs = opts.msgs || 0;
        this.size = opts.size || 0;
        this.subject = opts.subject || nuid_1.nuid.next();
        this.asyncRequests = opts.asyncRequests || false;
        this.pub = opts.pub || false;
        this.sub = opts.sub || false;
        this.req = opts.req || false;
        this.rep = opts.rep || false;
        this.perf = new util_1.Perf();
        this.payload = this.size ? new Uint8Array(this.size) : types_1.Empty;
        if (!this.pub && !this.sub && !this.req && !this.rep) {
            throw new Error("no bench option selected");
        }
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            this.nc.closed()
                .then((err) => {
                if (err) {
                    throw new core_1.NatsError(`bench closed with an error: ${err.message}`, core_1.ErrorCode.Unknown, err);
                }
            });
            if (this.callbacks) {
                yield this.runCallbacks();
            }
            else {
                yield this.runAsync();
            }
            return this.processMetrics();
        });
    }
    processMetrics() {
        const nc = this.nc;
        const { lang, version } = nc.protocol.transport;
        if (this.pub && this.sub) {
            this.perf.measure("pubsub", "pubStart", "subStop");
        }
        if (this.req && this.rep) {
            this.perf.measure("reqrep", "reqStart", "reqStop");
        }
        const measures = this.perf.getEntries();
        const pubsub = measures.find((m) => m.name === "pubsub");
        const reqrep = measures.find((m) => m.name === "reqrep");
        const req = measures.find((m) => m.name === "req");
        const rep = measures.find((m) => m.name === "rep");
        const pub = measures.find((m) => m.name === "pub");
        const sub = measures.find((m) => m.name === "sub");
        const stats = this.nc.stats();
        const metrics = [];
        if (pubsub) {
            const { name, duration } = pubsub;
            const m = new Metric(name, duration);
            m.msgs = this.msgs * 2;
            m.bytes = stats.inBytes + stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (reqrep) {
            const { name, duration } = reqrep;
            const m = new Metric(name, duration);
            m.msgs = this.msgs * 2;
            m.bytes = stats.inBytes + stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (pub) {
            const { name, duration } = pub;
            const m = new Metric(name, duration);
            m.msgs = this.msgs;
            m.bytes = stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (sub) {
            const { name, duration } = sub;
            const m = new Metric(name, duration);
            m.msgs = this.msgs;
            m.bytes = stats.inBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (rep) {
            const { name, duration } = rep;
            const m = new Metric(name, duration);
            m.msgs = this.msgs;
            m.bytes = stats.inBytes + stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        if (req) {
            const { name, duration } = req;
            const m = new Metric(name, duration);
            m.msgs = this.msgs;
            m.bytes = stats.inBytes + stats.outBytes;
            m.lang = lang;
            m.version = version;
            m.payload = this.payload.length;
            metrics.push(m);
        }
        return metrics;
    }
    runCallbacks() {
        return __awaiter(this, void 0, void 0, function* () {
            const jobs = [];
            if (this.sub) {
                const d = (0, util_1.deferred)();
                jobs.push(d);
                let i = 0;
                this.nc.subscribe(this.subject, {
                    max: this.msgs,
                    callback: () => {
                        i++;
                        if (i === 1) {
                            this.perf.mark("subStart");
                        }
                        if (i === this.msgs) {
                            this.perf.mark("subStop");
                            this.perf.measure("sub", "subStart", "subStop");
                            d.resolve();
                        }
                    },
                });
            }
            if (this.rep) {
                const d = (0, util_1.deferred)();
                jobs.push(d);
                let i = 0;
                this.nc.subscribe(this.subject, {
                    max: this.msgs,
                    callback: (_, m) => {
                        m.respond(this.payload);
                        i++;
                        if (i === 1) {
                            this.perf.mark("repStart");
                        }
                        if (i === this.msgs) {
                            this.perf.mark("repStop");
                            this.perf.measure("rep", "repStart", "repStop");
                            d.resolve();
                        }
                    },
                });
            }
            if (this.pub) {
                const job = (() => __awaiter(this, void 0, void 0, function* () {
                    this.perf.mark("pubStart");
                    for (let i = 0; i < this.msgs; i++) {
                        this.nc.publish(this.subject, this.payload);
                    }
                    yield this.nc.flush();
                    this.perf.mark("pubStop");
                    this.perf.measure("pub", "pubStart", "pubStop");
                }))();
                jobs.push(job);
            }
            if (this.req) {
                const job = (() => __awaiter(this, void 0, void 0, function* () {
                    if (this.asyncRequests) {
                        this.perf.mark("reqStart");
                        const a = [];
                        for (let i = 0; i < this.msgs; i++) {
                            a.push(this.nc.request(this.subject, this.payload, { timeout: 20000 }));
                        }
                        yield Promise.all(a);
                        this.perf.mark("reqStop");
                        this.perf.measure("req", "reqStart", "reqStop");
                    }
                    else {
                        this.perf.mark("reqStart");
                        for (let i = 0; i < this.msgs; i++) {
                            yield this.nc.request(this.subject);
                        }
                        this.perf.mark("reqStop");
                        this.perf.measure("req", "reqStart", "reqStop");
                    }
                }))();
                jobs.push(job);
            }
            yield Promise.all(jobs);
        });
    }
    runAsync() {
        return __awaiter(this, void 0, void 0, function* () {
            const jobs = [];
            if (this.rep) {
                let first = false;
                const sub = this.nc.subscribe(this.subject, { max: this.msgs });
                const job = (() => __awaiter(this, void 0, void 0, function* () {
                    var _a, e_1, _b, _c;
                    try {
                        for (var _d = true, sub_1 = __asyncValues(sub), sub_1_1; sub_1_1 = yield sub_1.next(), _a = sub_1_1.done, !_a; _d = true) {
                            _c = sub_1_1.value;
                            _d = false;
                            const m = _c;
                            if (!first) {
                                this.perf.mark("repStart");
                                first = true;
                            }
                            m.respond(this.payload);
                        }
                    }
                    catch (e_1_1) { e_1 = { error: e_1_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = sub_1.return)) yield _b.call(sub_1);
                        }
                        finally { if (e_1) throw e_1.error; }
                    }
                    yield this.nc.flush();
                    this.perf.mark("repStop");
                    this.perf.measure("rep", "repStart", "repStop");
                }))();
                jobs.push(job);
            }
            if (this.sub) {
                let first = false;
                const sub = this.nc.subscribe(this.subject, { max: this.msgs });
                const job = (() => __awaiter(this, void 0, void 0, function* () {
                    var _a, e_2, _b, _c;
                    try {
                        for (var _d = true, sub_2 = __asyncValues(sub), sub_2_1; sub_2_1 = yield sub_2.next(), _a = sub_2_1.done, !_a; _d = true) {
                            _c = sub_2_1.value;
                            _d = false;
                            const _m = _c;
                            if (!first) {
                                this.perf.mark("subStart");
                                first = true;
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (!_d && !_a && (_b = sub_2.return)) yield _b.call(sub_2);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    this.perf.mark("subStop");
                    this.perf.measure("sub", "subStart", "subStop");
                }))();
                jobs.push(job);
            }
            if (this.pub) {
                const job = (() => __awaiter(this, void 0, void 0, function* () {
                    this.perf.mark("pubStart");
                    for (let i = 0; i < this.msgs; i++) {
                        this.nc.publish(this.subject, this.payload);
                    }
                    yield this.nc.flush();
                    this.perf.mark("pubStop");
                    this.perf.measure("pub", "pubStart", "pubStop");
                }))();
                jobs.push(job);
            }
            if (this.req) {
                const job = (() => __awaiter(this, void 0, void 0, function* () {
                    if (this.asyncRequests) {
                        this.perf.mark("reqStart");
                        const a = [];
                        for (let i = 0; i < this.msgs; i++) {
                            a.push(this.nc.request(this.subject, this.payload, { timeout: 20000 }));
                        }
                        yield Promise.all(a);
                        this.perf.mark("reqStop");
                        this.perf.measure("req", "reqStart", "reqStop");
                    }
                    else {
                        this.perf.mark("reqStart");
                        for (let i = 0; i < this.msgs; i++) {
                            yield this.nc.request(this.subject);
                        }
                        this.perf.mark("reqStop");
                        this.perf.measure("req", "reqStart", "reqStop");
                    }
                }))();
                jobs.push(job);
            }
            yield Promise.all(jobs);
        });
    }
}
exports.Bench = Bench;
function throughput(bytes, seconds) {
    return `${humanizeBytes(bytes / seconds)}/sec`;
}
function msgThroughput(msgs, seconds) {
    return `${(Math.floor(msgs / seconds))} msgs/sec`;
}
function humanizeBytes(bytes, si = false) {
    const base = si ? 1000 : 1024;
    const pre = si
        ? ["k", "M", "G", "T", "P", "E"]
        : ["K", "M", "G", "T", "P", "E"];
    const post = si ? "iB" : "B";
    if (bytes < base) {
        return `${bytes.toFixed(2)} ${post}`;
    }
    const exp = parseInt(Math.log(bytes) / Math.log(base) + "");
    const index = parseInt((exp - 1) + "");
    return `${(bytes / Math.pow(base, exp)).toFixed(2)} ${pre[index]}${post}`;
}
function humanizeNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
//# sourceMappingURL=bench.js.map