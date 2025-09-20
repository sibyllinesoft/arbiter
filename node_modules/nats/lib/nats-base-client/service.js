"use strict";
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
exports.ServiceImpl = exports.ServiceGroupImpl = exports.ServiceMsgImpl = exports.ServiceApiPrefix = void 0;
/*
 * Copyright 2022-2023 The NATS Authors
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
const util_1 = require("./util");
const headers_1 = require("./headers");
const codec_1 = require("./codec");
const nuid_1 = require("./nuid");
const queued_iterator_1 = require("./queued_iterator");
const jsutil_1 = require("../jetstream/jsutil");
const semver_1 = require("./semver");
const encoders_1 = require("./encoders");
const core_1 = require("./core");
/**
 * Services have common backplane subject pattern:
 *
 * `$SRV.PING|STATS|INFO` - pings or retrieves status for all services
 * `$SRV.PING|STATS|INFO.<name>` - pings or retrieves status for all services having the specified name
 * `$SRV.PING|STATS|INFO.<name>.<id>` - pings or retrieves status of a particular service
 *
 * Note that <name> and <id> are upper-cased.
 */
exports.ServiceApiPrefix = "$SRV";
class ServiceMsgImpl {
    constructor(msg) {
        this.msg = msg;
    }
    get data() {
        return this.msg.data;
    }
    get sid() {
        return this.msg.sid;
    }
    get subject() {
        return this.msg.subject;
    }
    get reply() {
        return this.msg.reply || "";
    }
    get headers() {
        return this.msg.headers;
    }
    respond(data, opts) {
        return this.msg.respond(data, opts);
    }
    respondError(code, description, data, opts) {
        var _a, _b;
        opts = opts || {};
        opts.headers = opts.headers || (0, headers_1.headers)();
        (_a = opts.headers) === null || _a === void 0 ? void 0 : _a.set(core_1.ServiceErrorCodeHeader, `${code}`);
        (_b = opts.headers) === null || _b === void 0 ? void 0 : _b.set(core_1.ServiceErrorHeader, description);
        return this.msg.respond(data, opts);
    }
    json(reviver) {
        return this.msg.json(reviver);
    }
    string() {
        return this.msg.string();
    }
}
exports.ServiceMsgImpl = ServiceMsgImpl;
class ServiceGroupImpl {
    constructor(parent, name = "", queue = "") {
        if (name !== "") {
            validInternalToken("service group", name);
        }
        let root = "";
        if (parent instanceof ServiceImpl) {
            this.srv = parent;
            root = "";
        }
        else if (parent instanceof ServiceGroupImpl) {
            const sg = parent;
            this.srv = sg.srv;
            if (queue === "" && sg.queue !== "") {
                queue = sg.queue;
            }
            root = sg.subject;
        }
        else {
            throw new Error("unknown ServiceGroup type");
        }
        this.subject = this.calcSubject(root, name);
        this.queue = queue;
    }
    calcSubject(root, name = "") {
        if (name === "") {
            return root;
        }
        return root !== "" ? `${root}.${name}` : name;
    }
    addEndpoint(name = "", opts) {
        opts = opts || { subject: name };
        const args = typeof opts === "function"
            ? { handler: opts, subject: name }
            : opts;
        (0, jsutil_1.validateName)("endpoint", name);
        let { subject, handler, metadata, queue } = args;
        subject = subject || name;
        queue = queue || this.queue;
        validSubjectName("endpoint subject", subject);
        subject = this.calcSubject(this.subject, subject);
        const ne = { name, subject, queue, handler, metadata };
        return this.srv._addEndpoint(ne);
    }
    addGroup(name = "", queue = "") {
        return new ServiceGroupImpl(this, name, queue);
    }
}
exports.ServiceGroupImpl = ServiceGroupImpl;
function validSubjectName(context, subj) {
    if (subj === "") {
        throw new Error(`${context} cannot be empty`);
    }
    if (subj.indexOf(" ") !== -1) {
        throw new Error(`${context} cannot contain spaces: '${subj}'`);
    }
    const tokens = subj.split(".");
    tokens.forEach((v, idx) => {
        if (v === ">" && idx !== tokens.length - 1) {
            throw new Error(`${context} cannot have internal '>': '${subj}'`);
        }
    });
}
function validInternalToken(context, subj) {
    if (subj.indexOf(" ") !== -1) {
        throw new Error(`${context} cannot contain spaces: '${subj}'`);
    }
    const tokens = subj.split(".");
    tokens.forEach((v) => {
        if (v === ">") {
            throw new Error(`${context} name cannot contain internal '>': '${subj}'`);
        }
    });
}
class ServiceImpl {
    /**
     * @param verb
     * @param name
     * @param id
     * @param prefix - this is only supplied by tooling when building control subject that crosses an account
     */
    static controlSubject(verb, name = "", id = "", prefix) {
        // the prefix is used as is, because it is an
        // account boundary permission
        const pre = prefix !== null && prefix !== void 0 ? prefix : exports.ServiceApiPrefix;
        if (name === "" && id === "") {
            return `${pre}.${verb}`;
        }
        (0, jsutil_1.validateName)("control subject name", name);
        if (id !== "") {
            (0, jsutil_1.validateName)("control subject id", id);
            return `${pre}.${verb}.${name}.${id}`;
        }
        return `${pre}.${verb}.${name}`;
    }
    constructor(nc, config = { name: "", version: "" }) {
        this.nc = nc;
        this.config = Object.assign({}, config);
        if (!this.config.queue) {
            this.config.queue = "q";
        }
        // this will throw if no name
        (0, jsutil_1.validateName)("name", this.config.name);
        (0, jsutil_1.validateName)("queue", this.config.queue);
        // this will throw if not semver
        (0, semver_1.parseSemVer)(this.config.version);
        this._id = nuid_1.nuid.next();
        this.internal = [];
        this._done = (0, util_1.deferred)();
        this._stopped = false;
        this.handlers = [];
        this.started = new Date().toISOString();
        // initialize the stats
        this.reset();
        // close if the connection closes
        this.nc.closed()
            .then(() => {
            this.close().catch();
        })
            .catch((err) => {
            this.close(err).catch();
        });
    }
    get subjects() {
        return this.handlers.filter((s) => {
            return s.internal === false;
        }).map((s) => {
            return s.subject;
        });
    }
    get id() {
        return this._id;
    }
    get name() {
        return this.config.name;
    }
    get description() {
        var _a;
        return (_a = this.config.description) !== null && _a !== void 0 ? _a : "";
    }
    get version() {
        return this.config.version;
    }
    get metadata() {
        return this.config.metadata;
    }
    errorToHeader(err) {
        const h = (0, headers_1.headers)();
        if (err instanceof core_1.ServiceError) {
            const se = err;
            h.set(core_1.ServiceErrorHeader, se.message);
            h.set(core_1.ServiceErrorCodeHeader, `${se.code}`);
        }
        else {
            h.set(core_1.ServiceErrorHeader, err.message);
            h.set(core_1.ServiceErrorCodeHeader, "500");
        }
        return h;
    }
    setupHandler(h, internal = false) {
        // internals don't use a queue
        const queue = internal ? "" : (h.queue ? h.queue : this.config.queue);
        const { name, subject, handler } = h;
        const sv = h;
        sv.internal = internal;
        if (internal) {
            this.internal.push(sv);
        }
        sv.stats = new NamedEndpointStatsImpl(name, subject, queue);
        sv.queue = queue;
        const callback = handler
            ? (err, msg) => {
                if (err) {
                    this.close(err);
                    return;
                }
                const start = Date.now();
                try {
                    handler(err, new ServiceMsgImpl(msg));
                }
                catch (err) {
                    sv.stats.countError(err);
                    msg === null || msg === void 0 ? void 0 : msg.respond(encoders_1.Empty, { headers: this.errorToHeader(err) });
                }
                finally {
                    sv.stats.countLatency(start);
                }
            }
            : undefined;
        sv.sub = this.nc.subscribe(subject, {
            callback,
            queue,
        });
        sv.sub.closed
            .then(() => {
            if (!this._stopped) {
                this.close(new Error(`required subscription ${h.subject} stopped`))
                    .catch();
            }
        })
            .catch((err) => {
            if (!this._stopped) {
                const ne = new Error(`required subscription ${h.subject} errored: ${err.message}`);
                ne.stack = err.stack;
                this.close(ne).catch();
            }
        });
        return sv;
    }
    info() {
        return {
            type: core_1.ServiceResponseType.INFO,
            name: this.name,
            id: this.id,
            version: this.version,
            description: this.description,
            metadata: this.metadata,
            endpoints: this.endpoints(),
        };
    }
    endpoints() {
        return this.handlers.map((v) => {
            const { subject, metadata, name, queue } = v;
            return { subject, metadata, name, queue_group: queue };
        });
    }
    stats() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoints = [];
            for (const h of this.handlers) {
                if (typeof this.config.statsHandler === "function") {
                    try {
                        h.stats.data = yield this.config.statsHandler(h);
                    }
                    catch (err) {
                        h.stats.countError(err);
                    }
                }
                endpoints.push(h.stats.stats(h.qi));
            }
            return {
                type: core_1.ServiceResponseType.STATS,
                name: this.name,
                id: this.id,
                version: this.version,
                started: this.started,
                metadata: this.metadata,
                endpoints,
            };
        });
    }
    addInternalHandler(verb, handler) {
        const v = `${verb}`.toUpperCase();
        this._doAddInternalHandler(`${v}-all`, verb, handler);
        this._doAddInternalHandler(`${v}-kind`, verb, handler, this.name);
        this._doAddInternalHandler(`${v}`, verb, handler, this.name, this.id);
    }
    _doAddInternalHandler(name, verb, handler, kind = "", id = "") {
        const endpoint = {};
        endpoint.name = name;
        endpoint.subject = ServiceImpl.controlSubject(verb, kind, id);
        endpoint.handler = handler;
        this.setupHandler(endpoint, true);
    }
    start() {
        const jc = (0, codec_1.JSONCodec)();
        const statsHandler = (err, msg) => {
            if (err) {
                this.close(err);
                return Promise.reject(err);
            }
            return this.stats().then((s) => {
                msg === null || msg === void 0 ? void 0 : msg.respond(jc.encode(s));
                return Promise.resolve();
            });
        };
        const infoHandler = (err, msg) => {
            if (err) {
                this.close(err);
                return Promise.reject(err);
            }
            msg === null || msg === void 0 ? void 0 : msg.respond(jc.encode(this.info()));
            return Promise.resolve();
        };
        const ping = jc.encode(this.ping());
        const pingHandler = (err, msg) => {
            if (err) {
                this.close(err).then().catch();
                return Promise.reject(err);
            }
            msg.respond(ping);
            return Promise.resolve();
        };
        this.addInternalHandler(core_1.ServiceVerb.PING, pingHandler);
        this.addInternalHandler(core_1.ServiceVerb.STATS, statsHandler);
        this.addInternalHandler(core_1.ServiceVerb.INFO, infoHandler);
        // now the actual service
        this.handlers.forEach((h) => {
            const { subject } = h;
            if (typeof subject !== "string") {
                return;
            }
            // this is expected in cases where main subject is just
            // a root subject for multiple endpoints - user can disable
            // listening to the root endpoint, by specifying null
            if (h.handler === null) {
                return;
            }
            this.setupHandler(h);
        });
        return Promise.resolve(this);
    }
    close(err) {
        if (this._stopped) {
            return this._done;
        }
        this._stopped = true;
        let buf = [];
        if (!this.nc.isClosed()) {
            buf = this.handlers.concat(this.internal).map((h) => {
                return h.sub.drain();
            });
        }
        Promise.allSettled(buf)
            .then(() => {
            this._done.resolve(err ? err : null);
        });
        return this._done;
    }
    get stopped() {
        return this._done;
    }
    get isStopped() {
        return this._stopped;
    }
    stop(err) {
        return this.close(err);
    }
    ping() {
        return {
            type: core_1.ServiceResponseType.PING,
            name: this.name,
            id: this.id,
            version: this.version,
            metadata: this.metadata,
        };
    }
    reset() {
        // pretend we restarted
        this.started = new Date().toISOString();
        if (this.handlers) {
            for (const h of this.handlers) {
                h.stats.reset(h.qi);
            }
        }
    }
    addGroup(name, queue) {
        return new ServiceGroupImpl(this, name, queue);
    }
    addEndpoint(name, handler) {
        const sg = new ServiceGroupImpl(this);
        return sg.addEndpoint(name, handler);
    }
    _addEndpoint(e) {
        const qi = new queued_iterator_1.QueuedIteratorImpl();
        qi.noIterator = typeof e.handler === "function";
        if (!qi.noIterator) {
            e.handler = (err, msg) => {
                err ? this.stop(err).catch() : qi.push(new ServiceMsgImpl(msg));
            };
            // close the service if the iterator closes
            qi.iterClosed.then(() => {
                this.close().catch();
            });
        }
        // track the iterator for stats
        const ss = this.setupHandler(e, false);
        ss.qi = qi;
        this.handlers.push(ss);
        return qi;
    }
}
exports.ServiceImpl = ServiceImpl;
class NamedEndpointStatsImpl {
    constructor(name, subject, queue = "") {
        this.name = name;
        this.subject = subject;
        this.average_processing_time = 0;
        this.num_errors = 0;
        this.num_requests = 0;
        this.processing_time = 0;
        this.queue = queue;
    }
    reset(qi) {
        this.num_requests = 0;
        this.processing_time = 0;
        this.average_processing_time = 0;
        this.num_errors = 0;
        this.last_error = undefined;
        this.data = undefined;
        const qii = qi;
        if (qii) {
            qii.time = 0;
            qii.processed = 0;
        }
    }
    countLatency(start) {
        this.num_requests++;
        this.processing_time += (0, util_1.nanos)(Date.now() - start);
        this.average_processing_time = Math.round(this.processing_time / this.num_requests);
    }
    countError(err) {
        this.num_errors++;
        this.last_error = err.message;
    }
    _stats() {
        const { name, subject, average_processing_time, num_errors, num_requests, processing_time, last_error, data, queue, } = this;
        return {
            name,
            subject,
            average_processing_time,
            num_errors,
            num_requests,
            processing_time,
            last_error,
            data,
            queue_group: queue,
        };
    }
    stats(qi) {
        const qii = qi;
        if ((qii === null || qii === void 0 ? void 0 : qii.noIterator) === false) {
            // grab stats in the iterator
            this.processing_time = (0, util_1.nanos)(qii.time);
            this.num_requests = qii.processed;
            this.average_processing_time =
                this.processing_time > 0 && this.num_requests > 0
                    ? this.processing_time / this.num_requests
                    : 0;
        }
        return this._stats();
    }
}
//# sourceMappingURL=service.js.map