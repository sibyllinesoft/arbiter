"use strict";
/*
 * Copyright 2018-2023 The NATS Authors
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
exports.ServicesFactory = exports.NatsConnectionImpl = void 0;
const util_1 = require("./util");
const protocol_1 = require("./protocol");
const encoders_1 = require("./encoders");
const types_1 = require("./types");
const semver_1 = require("./semver");
const options_1 = require("./options");
const queued_iterator_1 = require("./queued_iterator");
const request_1 = require("./request");
const msg_1 = require("./msg");
const jsm_1 = require("../jetstream/jsm");
const jsclient_1 = require("../jetstream/jsclient");
const service_1 = require("./service");
const serviceclient_1 = require("./serviceclient");
const core_1 = require("./core");
class NatsConnectionImpl {
    constructor(opts) {
        this.draining = false;
        this.options = (0, options_1.parseOptions)(opts);
        this.listeners = [];
    }
    static connect(opts = {}) {
        return new Promise((resolve, reject) => {
            const nc = new NatsConnectionImpl(opts);
            protocol_1.ProtocolHandler.connect(nc.options, nc)
                .then((ph) => {
                nc.protocol = ph;
                (function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        var _a, e_1, _b, _c;
                        try {
                            for (var _d = true, _e = __asyncValues(ph.status()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                                _c = _f.value;
                                _d = false;
                                const s = _c;
                                nc.listeners.forEach((l) => {
                                    l.push(s);
                                });
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    });
                })();
                resolve(nc);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    closed() {
        return this.protocol.closed;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.protocol.close();
        });
    }
    _check(subject, sub, pub) {
        if (this.isClosed()) {
            throw types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionClosed);
        }
        if (sub && this.isDraining()) {
            throw types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionDraining);
        }
        if (pub && this.protocol.noMorePublishing) {
            throw types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionDraining);
        }
        subject = subject || "";
        if (subject.length === 0) {
            throw types_1.NatsError.errorForCode(core_1.ErrorCode.BadSubject);
        }
    }
    publish(subject, data, options) {
        this._check(subject, false, true);
        this.protocol.publish(subject, data, options);
    }
    publishMessage(msg) {
        return this.publish(msg.subject, msg.data, {
            reply: msg.reply,
            headers: msg.headers,
        });
    }
    respondMessage(msg) {
        if (msg.reply) {
            this.publish(msg.reply, msg.data, {
                reply: msg.reply,
                headers: msg.headers,
            });
            return true;
        }
        return false;
    }
    subscribe(subject, opts = {}) {
        this._check(subject, true, false);
        const sub = new protocol_1.SubscriptionImpl(this.protocol, subject, opts);
        this.protocol.subscribe(sub);
        return sub;
    }
    _resub(s, subject, max) {
        this._check(subject, true, false);
        const si = s;
        // FIXME: need way of understanding a callbacks processed
        //   count without it, we cannot really do much - ie
        //   for rejected messages, the count would be lower, etc.
        //   To handle cases were for example KV is building a map
        //   the consumer would say how many messages we need to do
        //   a proper build before we can handle updates.
        si.max = max; // this might clear it
        if (max) {
            // we cannot auto-unsub, because we don't know the
            // number of messages we processed vs received
            // allow the auto-unsub on processMsg to work if they
            // we were called with a new max
            si.max = max + si.received;
        }
        this.protocol.resub(si, subject);
    }
    // possibilities are:
    // stop on error or any non-100 status
    // AND:
    // - wait for timer
    // - wait for n messages or timer
    // - wait for unknown messages, done when empty or reset timer expires (with possible alt wait)
    // - wait for unknown messages, done when an empty payload is received or timer expires (with possible alt wait)
    requestMany(subject, data = encoders_1.Empty, opts = { maxWait: 1000, maxMessages: -1 }) {
        const asyncTraces = !(this.protocol.options.noAsyncTraces || false);
        try {
            this._check(subject, true, true);
        }
        catch (err) {
            return Promise.reject(err);
        }
        opts.strategy = opts.strategy || core_1.RequestStrategy.Timer;
        opts.maxWait = opts.maxWait || 1000;
        if (opts.maxWait < 1) {
            return Promise.reject(new types_1.NatsError("timeout", core_1.ErrorCode.InvalidOption));
        }
        // the iterator for user results
        const qi = new queued_iterator_1.QueuedIteratorImpl();
        function stop(err) {
            //@ts-ignore: stop function
            qi.push(() => {
                qi.stop(err);
            });
        }
        // callback for the subscription or the mux handler
        // simply pushes errors and messages into the iterator
        function callback(err, msg) {
            if (err || msg === null) {
                stop(err === null ? undefined : err);
            }
            else {
                qi.push(msg);
            }
        }
        if (opts.noMux) {
            // we setup a subscription and manage it
            const stack = asyncTraces ? new Error().stack : null;
            let max = typeof opts.maxMessages === "number" && opts.maxMessages > 0
                ? opts.maxMessages
                : -1;
            const sub = this.subscribe((0, core_1.createInbox)(this.options.inboxPrefix), {
                callback: (err, msg) => {
                    var _a, _b;
                    // we only expect runtime errors or a no responders
                    if (((_a = msg === null || msg === void 0 ? void 0 : msg.data) === null || _a === void 0 ? void 0 : _a.length) === 0 &&
                        ((_b = msg === null || msg === void 0 ? void 0 : msg.headers) === null || _b === void 0 ? void 0 : _b.status) === core_1.ErrorCode.NoResponders) {
                        err = types_1.NatsError.errorForCode(core_1.ErrorCode.NoResponders);
                    }
                    // augment any error with the current stack to provide context
                    // for the error on the suer code
                    if (err) {
                        if (stack) {
                            err.stack += `\n\n${stack}`;
                        }
                        cancel(err);
                        return;
                    }
                    // push the message
                    callback(null, msg);
                    // see if the m request is completed
                    if (opts.strategy === core_1.RequestStrategy.Count) {
                        max--;
                        if (max === 0) {
                            cancel();
                        }
                    }
                    if (opts.strategy === core_1.RequestStrategy.JitterTimer) {
                        clearTimers();
                        timer = setTimeout(() => {
                            cancel();
                        }, 300);
                    }
                    if (opts.strategy === core_1.RequestStrategy.SentinelMsg) {
                        if (msg && msg.data.length === 0) {
                            cancel();
                        }
                    }
                },
            });
            sub.requestSubject = subject;
            sub.closed
                .then(() => {
                stop();
            })
                .catch((err) => {
                qi.stop(err);
            });
            const cancel = (err) => {
                if (err) {
                    //@ts-ignore: error
                    qi.push(() => {
                        throw err;
                    });
                }
                clearTimers();
                sub.drain()
                    .then(() => {
                    stop();
                })
                    .catch((_err) => {
                    stop();
                });
            };
            qi.iterClosed
                .then(() => {
                clearTimers();
                sub === null || sub === void 0 ? void 0 : sub.unsubscribe();
            })
                .catch((_err) => {
                clearTimers();
                sub === null || sub === void 0 ? void 0 : sub.unsubscribe();
            });
            try {
                this.publish(subject, data, { reply: sub.getSubject() });
            }
            catch (err) {
                cancel(err);
            }
            let timer = setTimeout(() => {
                cancel();
            }, opts.maxWait);
            const clearTimers = () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }
        else {
            // the ingestion is the RequestMany
            const rmo = opts;
            rmo.callback = callback;
            qi.iterClosed.then(() => {
                r.cancel();
            }).catch((err) => {
                r.cancel(err);
            });
            const r = new request_1.RequestMany(this.protocol.muxSubscriptions, subject, rmo);
            this.protocol.request(r);
            try {
                this.publish(subject, data, {
                    reply: `${this.protocol.muxSubscriptions.baseInbox}${r.token}`,
                    headers: opts.headers,
                });
            }
            catch (err) {
                r.cancel(err);
            }
        }
        return Promise.resolve(qi);
    }
    request(subject, data, opts = { timeout: 1000, noMux: false }) {
        try {
            this._check(subject, true, true);
        }
        catch (err) {
            return Promise.reject(err);
        }
        const asyncTraces = !(this.protocol.options.noAsyncTraces || false);
        opts.timeout = opts.timeout || 1000;
        if (opts.timeout < 1) {
            return Promise.reject(new types_1.NatsError("timeout", core_1.ErrorCode.InvalidOption));
        }
        if (!opts.noMux && opts.reply) {
            return Promise.reject(new types_1.NatsError("reply can only be used with noMux", core_1.ErrorCode.InvalidOption));
        }
        if (opts.noMux) {
            const inbox = opts.reply
                ? opts.reply
                : (0, core_1.createInbox)(this.options.inboxPrefix);
            const d = (0, util_1.deferred)();
            const errCtx = asyncTraces ? new Error() : null;
            const sub = this.subscribe(inbox, {
                max: 1,
                timeout: opts.timeout,
                callback: (err, msg) => {
                    if (err) {
                        // timeouts from `timeout()` will have the proper stack
                        if (errCtx && err.code !== core_1.ErrorCode.Timeout) {
                            err.stack += `\n\n${errCtx.stack}`;
                        }
                        sub.unsubscribe();
                        d.reject(err);
                    }
                    else {
                        err = (0, msg_1.isRequestError)(msg);
                        if (err) {
                            // if we failed here, help the developer by showing what failed
                            if (errCtx) {
                                err.stack += `\n\n${errCtx.stack}`;
                            }
                            d.reject(err);
                        }
                        else {
                            d.resolve(msg);
                        }
                    }
                },
            });
            sub.requestSubject = subject;
            this.protocol.publish(subject, data, {
                reply: inbox,
                headers: opts.headers,
            });
            return d;
        }
        else {
            const r = new request_1.RequestOne(this.protocol.muxSubscriptions, subject, opts, asyncTraces);
            this.protocol.request(r);
            try {
                this.publish(subject, data, {
                    reply: `${this.protocol.muxSubscriptions.baseInbox}${r.token}`,
                    headers: opts.headers,
                });
            }
            catch (err) {
                r.cancel(err);
            }
            const p = Promise.race([r.timer, r.deferred]);
            p.catch(() => {
                r.cancel();
            });
            return p;
        }
    }
    /** *
     * Flushes to the server. Promise resolves when round-trip completes.
     * @returns {Promise<void>}
     */
    flush() {
        if (this.isClosed()) {
            return Promise.reject(types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionClosed));
        }
        return this.protocol.flush();
    }
    drain() {
        if (this.isClosed()) {
            return Promise.reject(types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionClosed));
        }
        if (this.isDraining()) {
            return Promise.reject(types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionDraining));
        }
        this.draining = true;
        return this.protocol.drain();
    }
    isClosed() {
        return this.protocol.isClosed();
    }
    isDraining() {
        return this.draining;
    }
    getServer() {
        const srv = this.protocol.getServer();
        return srv ? srv.listen : "";
    }
    status() {
        const iter = new queued_iterator_1.QueuedIteratorImpl();
        iter.iterClosed.then(() => {
            const idx = this.listeners.indexOf(iter);
            this.listeners.splice(idx, 1);
        });
        this.listeners.push(iter);
        return iter;
    }
    get info() {
        return this.protocol.isClosed() ? undefined : this.protocol.info;
    }
    context() {
        return __awaiter(this, void 0, void 0, function* () {
            const r = yield this.request(`$SYS.REQ.USER.INFO`);
            return r.json((key, value) => {
                if (key === "time") {
                    return new Date(Date.parse(value));
                }
                return value;
            });
        });
    }
    stats() {
        return {
            inBytes: this.protocol.inBytes,
            outBytes: this.protocol.outBytes,
            inMsgs: this.protocol.inMsgs,
            outMsgs: this.protocol.outMsgs,
        };
    }
    jetstreamManager() {
        return __awaiter(this, arguments, void 0, function* (opts = {}) {
            const adm = new jsm_1.JetStreamManagerImpl(this, opts);
            if (opts.checkAPI !== false) {
                try {
                    yield adm.getAccountInfo();
                }
                catch (err) {
                    const ne = err;
                    if (ne.code === core_1.ErrorCode.NoResponders) {
                        ne.code = core_1.ErrorCode.JetStreamNotEnabled;
                    }
                    throw ne;
                }
            }
            return adm;
        });
    }
    jetstream(opts = {}) {
        return new jsclient_1.JetStreamClientImpl(this, opts);
    }
    getServerVersion() {
        const info = this.info;
        return info ? (0, semver_1.parseSemVer)(info.version) : undefined;
    }
    rtt() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.protocol._closed && !this.protocol.connected) {
                throw types_1.NatsError.errorForCode(core_1.ErrorCode.Disconnect);
            }
            const start = Date.now();
            yield this.flush();
            return Date.now() - start;
        });
    }
    get features() {
        return this.protocol.features;
    }
    get services() {
        if (!this._services) {
            this._services = new ServicesFactory(this);
        }
        return this._services;
    }
    reconnect() {
        if (this.isClosed()) {
            return Promise.reject(types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionClosed));
        }
        if (this.isDraining()) {
            return Promise.reject(types_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionDraining));
        }
        return this.protocol.reconnect();
    }
}
exports.NatsConnectionImpl = NatsConnectionImpl;
class ServicesFactory {
    constructor(nc) {
        this.nc = nc;
    }
    add(config) {
        try {
            const s = new service_1.ServiceImpl(this.nc, config);
            return s.start();
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    client(opts, prefix) {
        return new serviceclient_1.ServiceClientImpl(this.nc, opts, prefix);
    }
}
exports.ServicesFactory = ServicesFactory;
//# sourceMappingURL=nats.js.map