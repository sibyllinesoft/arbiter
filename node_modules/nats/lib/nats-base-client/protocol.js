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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolHandler = exports.Subscriptions = exports.SubscriptionImpl = exports.Connect = exports.INFO = void 0;
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
const encoders_1 = require("./encoders");
const transport_1 = require("./transport");
const util_1 = require("./util");
const databuffer_1 = require("./databuffer");
const servers_1 = require("./servers");
const queued_iterator_1 = require("./queued_iterator");
const muxsubscription_1 = require("./muxsubscription");
const heartbeats_1 = require("./heartbeats");
const parser_1 = require("./parser");
const msg_1 = require("./msg");
const semver_1 = require("./semver");
const core_1 = require("./core");
const options_1 = require("./options");
const FLUSH_THRESHOLD = 1024 * 32;
exports.INFO = /^INFO\s+([^\r\n]+)\r\n/i;
const PONG_CMD = (0, encoders_1.encode)("PONG\r\n");
const PING_CMD = (0, encoders_1.encode)("PING\r\n");
class Connect {
    constructor(transport, opts, nonce) {
        this.protocol = 1;
        this.version = transport.version;
        this.lang = transport.lang;
        this.echo = opts.noEcho ? false : undefined;
        this.verbose = opts.verbose;
        this.pedantic = opts.pedantic;
        this.tls_required = opts.tls ? true : undefined;
        this.name = opts.name;
        const creds = (opts && typeof opts.authenticator === "function"
            ? opts.authenticator(nonce)
            : {}) || {};
        (0, util_1.extend)(this, creds);
    }
}
exports.Connect = Connect;
class SubscriptionImpl extends queued_iterator_1.QueuedIteratorImpl {
    constructor(protocol, subject, opts = {}) {
        var _a;
        super();
        (0, util_1.extend)(this, opts);
        this.protocol = protocol;
        this.subject = subject;
        this.draining = false;
        this.noIterator = typeof opts.callback === "function";
        this.closed = (0, util_1.deferred)();
        const asyncTraces = !(((_a = protocol.options) === null || _a === void 0 ? void 0 : _a.noAsyncTraces) || false);
        if (opts.timeout) {
            this.timer = (0, util_1.timeout)(opts.timeout, asyncTraces);
            this.timer
                .then(() => {
                // timer was cancelled
                this.timer = undefined;
            })
                .catch((err) => {
                // timer fired
                this.stop(err);
                if (this.noIterator) {
                    this.callback(err, {});
                }
            });
        }
        if (!this.noIterator) {
            // cleanup - they used break or return from the iterator
            // make sure we clean up, if they didn't call unsub
            this.iterClosed.then(() => {
                this.closed.resolve();
                this.unsubscribe();
            });
        }
    }
    setPrePostHandlers(opts) {
        if (this.noIterator) {
            const uc = this.callback;
            const ingestion = opts.ingestionFilterFn
                ? opts.ingestionFilterFn
                : () => {
                    return { ingest: true, protocol: false };
                };
            const filter = opts.protocolFilterFn ? opts.protocolFilterFn : () => {
                return true;
            };
            const dispatched = opts.dispatchedFn ? opts.dispatchedFn : () => { };
            this.callback = (err, msg) => {
                const { ingest } = ingestion(msg);
                if (!ingest) {
                    return;
                }
                if (filter(msg)) {
                    uc(err, msg);
                    dispatched(msg);
                }
            };
        }
        else {
            this.protocolFilterFn = opts.protocolFilterFn;
            this.dispatchedFn = opts.dispatchedFn;
        }
    }
    callback(err, msg) {
        this.cancelTimeout();
        err ? this.stop(err) : this.push(msg);
    }
    close() {
        if (!this.isClosed()) {
            this.cancelTimeout();
            const fn = () => {
                this.stop();
                if (this.cleanupFn) {
                    try {
                        this.cleanupFn(this, this.info);
                    }
                    catch (_err) {
                        // ignoring
                    }
                }
                this.closed.resolve();
            };
            if (this.noIterator) {
                fn();
            }
            else {
                //@ts-ignore: schedule the close once all messages are processed
                this.push(fn);
            }
        }
    }
    unsubscribe(max) {
        this.protocol.unsubscribe(this, max);
    }
    cancelTimeout() {
        if (this.timer) {
            this.timer.cancel();
            this.timer = undefined;
        }
    }
    drain() {
        if (this.protocol.isClosed()) {
            return Promise.reject(core_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionClosed));
        }
        if (this.isClosed()) {
            return Promise.reject(core_1.NatsError.errorForCode(core_1.ErrorCode.SubClosed));
        }
        if (!this.drained) {
            this.draining = true;
            this.protocol.unsub(this);
            this.drained = this.protocol.flush((0, util_1.deferred)())
                .then(() => {
                this.protocol.subscriptions.cancel(this);
            })
                .catch(() => {
                this.protocol.subscriptions.cancel(this);
            });
        }
        return this.drained;
    }
    isDraining() {
        return this.draining;
    }
    isClosed() {
        return this.done;
    }
    getSubject() {
        return this.subject;
    }
    getMax() {
        return this.max;
    }
    getID() {
        return this.sid;
    }
}
exports.SubscriptionImpl = SubscriptionImpl;
class Subscriptions {
    constructor() {
        this.sidCounter = 0;
        this.mux = null;
        this.subs = new Map();
    }
    size() {
        return this.subs.size;
    }
    add(s) {
        this.sidCounter++;
        s.sid = this.sidCounter;
        this.subs.set(s.sid, s);
        return s;
    }
    setMux(s) {
        this.mux = s;
        return s;
    }
    getMux() {
        return this.mux;
    }
    get(sid) {
        return this.subs.get(sid);
    }
    resub(s) {
        this.sidCounter++;
        this.subs.delete(s.sid);
        s.sid = this.sidCounter;
        this.subs.set(s.sid, s);
        return s;
    }
    all() {
        return Array.from(this.subs.values());
    }
    cancel(s) {
        if (s) {
            s.close();
            this.subs.delete(s.sid);
        }
    }
    handleError(err) {
        if (err && err.permissionContext) {
            const ctx = err.permissionContext;
            const subs = this.all();
            let sub;
            if (ctx.operation === "subscription") {
                sub = subs.find((s) => {
                    return s.subject === ctx.subject && s.queue === ctx.queue;
                });
            }
            if (ctx.operation === "publish") {
                // we have a no mux subscription
                sub = subs.find((s) => {
                    return s.requestSubject === ctx.subject;
                });
            }
            if (sub) {
                sub.callback(err, {});
                sub.close();
                this.subs.delete(sub.sid);
                return sub !== this.mux;
            }
        }
        return false;
    }
    close() {
        this.subs.forEach((sub) => {
            sub.close();
        });
    }
}
exports.Subscriptions = Subscriptions;
class ProtocolHandler {
    constructor(options, publisher) {
        this._closed = false;
        this.connected = false;
        this.connectedOnce = false;
        this.infoReceived = false;
        this.noMorePublishing = false;
        this.abortReconnect = false;
        this.listeners = [];
        this.pendingLimit = FLUSH_THRESHOLD;
        this.outMsgs = 0;
        this.inMsgs = 0;
        this.outBytes = 0;
        this.inBytes = 0;
        this.options = options;
        this.publisher = publisher;
        this.subscriptions = new Subscriptions();
        this.muxSubscriptions = new muxsubscription_1.MuxSubscription();
        this.outbound = new databuffer_1.DataBuffer();
        this.pongs = [];
        this.whyClosed = "";
        //@ts-ignore: options.pendingLimit is hidden
        this.pendingLimit = options.pendingLimit || this.pendingLimit;
        this.features = new semver_1.Features({ major: 0, minor: 0, micro: 0 });
        this.connectPromise = null;
        const servers = typeof options.servers === "string"
            ? [options.servers]
            : options.servers;
        this.servers = new servers_1.Servers(servers, {
            randomize: !options.noRandomize,
        });
        this.closed = (0, util_1.deferred)();
        this.parser = new parser_1.Parser(this);
        this.heartbeats = new heartbeats_1.Heartbeat(this, this.options.pingInterval || options_1.DEFAULT_PING_INTERVAL, this.options.maxPingOut || options_1.DEFAULT_MAX_PING_OUT);
    }
    resetOutbound() {
        this.outbound.reset();
        const pongs = this.pongs;
        this.pongs = [];
        // reject the pongs - the disconnect from here shouldn't have a trace
        // because that confuses API consumers
        const err = core_1.NatsError.errorForCode(core_1.ErrorCode.Disconnect);
        err.stack = "";
        pongs.forEach((p) => {
            p.reject(err);
        });
        this.parser = new parser_1.Parser(this);
        this.infoReceived = false;
    }
    dispatchStatus(status) {
        this.listeners.forEach((q) => {
            q.push(status);
        });
    }
    status() {
        const iter = new queued_iterator_1.QueuedIteratorImpl();
        this.listeners.push(iter);
        return iter;
    }
    prepare() {
        if (this.transport) {
            this.transport.discard();
        }
        this.info = undefined;
        this.resetOutbound();
        const pong = (0, util_1.deferred)();
        pong.catch(() => {
            // provide at least one catch - as pong rejection can happen before it is expected
        });
        this.pongs.unshift(pong);
        this.connectError = (err) => {
            pong.reject(err);
        };
        this.transport = (0, transport_1.newTransport)();
        this.transport.closed()
            .then((_err) => __awaiter(this, void 0, void 0, function* () {
            this.connected = false;
            if (!this.isClosed()) {
                // if the transport gave an error use that, otherwise
                // we may have received a protocol error
                yield this.disconnected(this.transport.closeError || this.lastError);
                return;
            }
        }));
        return pong;
    }
    disconnect() {
        this.dispatchStatus({ type: core_1.DebugEvents.StaleConnection, data: "" });
        this.transport.disconnect();
    }
    reconnect() {
        if (this.connected) {
            this.dispatchStatus({
                type: core_1.DebugEvents.ClientInitiatedReconnect,
                data: "",
            });
            this.transport.disconnect();
        }
        return Promise.resolve();
    }
    disconnected(err) {
        return __awaiter(this, void 0, void 0, function* () {
            this.dispatchStatus({
                type: core_1.Events.Disconnect,
                data: this.servers.getCurrentServer().toString(),
            });
            if (this.options.reconnect) {
                yield this.dialLoop()
                    .then(() => {
                    var _a;
                    this.dispatchStatus({
                        type: core_1.Events.Reconnect,
                        data: this.servers.getCurrentServer().toString(),
                    });
                    // if we are here we reconnected, but we have an authentication
                    // that expired, we need to clean it up, otherwise we'll queue up
                    // two of these, and the default for the client will be to
                    // close, rather than attempt again - possibly they have an
                    // authenticator that dynamically updates
                    if (((_a = this.lastError) === null || _a === void 0 ? void 0 : _a.code) === core_1.ErrorCode.AuthenticationExpired) {
                        this.lastError = undefined;
                    }
                })
                    .catch((err) => {
                    this._close(err);
                });
            }
            else {
                yield this._close(err);
            }
        });
    }
    dial(srv) {
        return __awaiter(this, void 0, void 0, function* () {
            const pong = this.prepare();
            let timer;
            try {
                timer = (0, util_1.timeout)(this.options.timeout || 20000);
                const cp = this.transport.connect(srv, this.options);
                yield Promise.race([cp, timer]);
                (() => __awaiter(this, void 0, void 0, function* () {
                    var _a, e_1, _b, _c;
                    try {
                        try {
                            for (var _d = true, _e = __asyncValues(this.transport), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                                _c = _f.value;
                                _d = false;
                                const b = _c;
                                this.parser.parse(b);
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                    catch (err) {
                        console.log("reader closed", err);
                    }
                }))().then();
            }
            catch (err) {
                pong.reject(err);
            }
            try {
                yield Promise.race([timer, pong]);
                if (timer) {
                    timer.cancel();
                }
                this.connected = true;
                this.connectError = undefined;
                this.sendSubscriptions();
                this.connectedOnce = true;
                this.server.didConnect = true;
                this.server.reconnects = 0;
                this.flushPending();
                this.heartbeats.start();
            }
            catch (err) {
                if (timer) {
                    timer.cancel();
                }
                yield this.transport.close(err);
                throw err;
            }
        });
    }
    _doDial(srv) {
        return __awaiter(this, void 0, void 0, function* () {
            const { resolve } = this.options;
            const alts = yield srv.resolve({
                fn: (0, transport_1.getResolveFn)(),
                debug: this.options.debug,
                randomize: !this.options.noRandomize,
                resolve,
            });
            let lastErr = null;
            for (const a of alts) {
                try {
                    lastErr = null;
                    this.dispatchStatus({ type: core_1.DebugEvents.Reconnecting, data: a.toString() });
                    yield this.dial(a);
                    // if here we connected
                    return;
                }
                catch (err) {
                    lastErr = err;
                }
            }
            // if we are here, we failed, and we have no additional
            // alternatives for this server
            throw lastErr;
        });
    }
    dialLoop() {
        if (this.connectPromise === null) {
            this.connectPromise = this.dodialLoop();
            this.connectPromise
                .then(() => { })
                .catch(() => { })
                .finally(() => {
                this.connectPromise = null;
            });
        }
        return this.connectPromise;
    }
    dodialLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            let lastError;
            while (true) {
                if (this._closed) {
                    // if we are disconnected, and close is called, the client
                    // still tries to reconnect - to match the reconnect policy
                    // in the case of close, want to stop.
                    this.servers.clear();
                }
                const wait = this.options.reconnectDelayHandler
                    ? this.options.reconnectDelayHandler()
                    : options_1.DEFAULT_RECONNECT_TIME_WAIT;
                let maxWait = wait;
                const srv = this.selectServer();
                if (!srv || this.abortReconnect) {
                    if (lastError) {
                        throw lastError;
                    }
                    else if (this.lastError) {
                        throw this.lastError;
                    }
                    else {
                        throw core_1.NatsError.errorForCode(core_1.ErrorCode.ConnectionRefused);
                    }
                }
                const now = Date.now();
                if (srv.lastConnect === 0 || srv.lastConnect + wait <= now) {
                    srv.lastConnect = Date.now();
                    try {
                        yield this._doDial(srv);
                        break;
                    }
                    catch (err) {
                        lastError = err;
                        if (!this.connectedOnce) {
                            if (this.options.waitOnFirstConnect) {
                                continue;
                            }
                            this.servers.removeCurrentServer();
                        }
                        srv.reconnects++;
                        const mra = this.options.maxReconnectAttempts || 0;
                        if (mra !== -1 && srv.reconnects >= mra) {
                            this.servers.removeCurrentServer();
                        }
                    }
                }
                else {
                    maxWait = Math.min(maxWait, srv.lastConnect + wait - now);
                    yield (0, util_1.delay)(maxWait);
                }
            }
        });
    }
    static connect(options, publisher) {
        return __awaiter(this, void 0, void 0, function* () {
            const h = new ProtocolHandler(options, publisher);
            yield h.dialLoop();
            return h;
        });
    }
    static toError(s) {
        const t = s ? s.toLowerCase() : "";
        if (t.indexOf("permissions violation") !== -1) {
            const err = new core_1.NatsError(s, core_1.ErrorCode.PermissionsViolation);
            const m = s.match(/(Publish|Subscription) to "(\S+)"/);
            if (m) {
                err.permissionContext = {
                    operation: m[1].toLowerCase(),
                    subject: m[2],
                    queue: undefined,
                };
                const qm = s.match(/using queue "(\S+)"/);
                if (qm) {
                    err.permissionContext.queue = qm[1];
                }
            }
            return err;
        }
        else if (t.indexOf("authorization violation") !== -1) {
            return new core_1.NatsError(s, core_1.ErrorCode.AuthorizationViolation);
        }
        else if (t.indexOf("user authentication expired") !== -1) {
            return new core_1.NatsError(s, core_1.ErrorCode.AuthenticationExpired);
        }
        else if (t.indexOf("account authentication expired") != -1) {
            return new core_1.NatsError(s, core_1.ErrorCode.AccountExpired);
        }
        else if (t.indexOf("authentication timeout") !== -1) {
            return new core_1.NatsError(s, core_1.ErrorCode.AuthenticationTimeout);
        }
        else {
            return new core_1.NatsError(s, core_1.ErrorCode.ProtocolError);
        }
    }
    processMsg(msg, data) {
        this.inMsgs++;
        this.inBytes += data.length;
        if (!this.subscriptions.sidCounter) {
            return;
        }
        const sub = this.subscriptions.get(msg.sid);
        if (!sub) {
            return;
        }
        sub.received += 1;
        if (sub.callback) {
            sub.callback(null, new msg_1.MsgImpl(msg, data, this));
        }
        if (sub.max !== undefined && sub.received >= sub.max) {
            sub.unsubscribe();
        }
    }
    processError(m) {
        const s = (0, encoders_1.decode)(m);
        const err = ProtocolHandler.toError(s);
        const status = { type: core_1.Events.Error, data: err.code };
        if (err.isPermissionError()) {
            let isMuxPermissionError = false;
            if (err.permissionContext) {
                status.permissionContext = err.permissionContext;
                const mux = this.subscriptions.getMux();
                isMuxPermissionError = (mux === null || mux === void 0 ? void 0 : mux.subject) === err.permissionContext.subject;
            }
            this.subscriptions.handleError(err);
            this.muxSubscriptions.handleError(isMuxPermissionError, err);
            if (isMuxPermissionError) {
                // remove the permission - enable it to be recreated
                this.subscriptions.setMux(null);
            }
        }
        this.dispatchStatus(status);
        this.handleError(err);
    }
    handleError(err) {
        if (err.isAuthError()) {
            this.handleAuthError(err);
        }
        else if (err.isProtocolError()) {
            this.lastError = err;
        }
        else if (err.isAuthTimeout()) {
            this.lastError = err;
        }
        // fallthrough here
        if (!err.isPermissionError()) {
            this.lastError = err;
        }
    }
    handleAuthError(err) {
        if ((this.lastError && err.code === this.lastError.code) &&
            this.options.ignoreAuthErrorAbort === false) {
            this.abortReconnect = true;
        }
        if (this.connectError) {
            this.connectError(err);
        }
        else {
            this.disconnect();
        }
    }
    processPing() {
        this.transport.send(PONG_CMD);
    }
    processPong() {
        const cb = this.pongs.shift();
        if (cb) {
            cb.resolve();
        }
    }
    processInfo(m) {
        const info = JSON.parse((0, encoders_1.decode)(m));
        this.info = info;
        const updates = this.options && this.options.ignoreClusterUpdates
            ? undefined
            : this.servers.update(info, this.transport.isEncrypted());
        if (!this.infoReceived) {
            this.features.update((0, semver_1.parseSemVer)(info.version));
            this.infoReceived = true;
            if (this.transport.isEncrypted()) {
                this.servers.updateTLSName();
            }
            // send connect
            const { version, lang } = this.transport;
            try {
                const c = new Connect({ version, lang }, this.options, info.nonce);
                if (info.headers) {
                    c.headers = true;
                    c.no_responders = true;
                }
                const cs = JSON.stringify(c);
                this.transport.send((0, encoders_1.encode)(`CONNECT ${cs}${transport_1.CR_LF}`));
                this.transport.send(PING_CMD);
            }
            catch (err) {
                // if we are dying here, this is likely some an authenticator blowing up
                this._close(err);
            }
        }
        if (updates) {
            this.dispatchStatus({ type: core_1.Events.Update, data: updates });
        }
        const ldm = info.ldm !== undefined ? info.ldm : false;
        if (ldm) {
            this.dispatchStatus({
                type: core_1.Events.LDM,
                data: this.servers.getCurrentServer().toString(),
            });
        }
    }
    push(e) {
        switch (e.kind) {
            case parser_1.Kind.MSG: {
                const { msg, data } = e;
                this.processMsg(msg, data);
                break;
            }
            case parser_1.Kind.OK:
                break;
            case parser_1.Kind.ERR:
                this.processError(e.data);
                break;
            case parser_1.Kind.PING:
                this.processPing();
                break;
            case parser_1.Kind.PONG:
                this.processPong();
                break;
            case parser_1.Kind.INFO:
                this.processInfo(e.data);
                break;
        }
    }
    sendCommand(cmd, ...payloads) {
        const len = this.outbound.length();
        let buf;
        if (typeof cmd === "string") {
            buf = (0, encoders_1.encode)(cmd);
        }
        else {
            buf = cmd;
        }
        this.outbound.fill(buf, ...payloads);
        if (len === 0) {
            queueMicrotask(() => {
                this.flushPending();
            });
        }
        else if (this.outbound.size() >= this.pendingLimit) {
            // flush inline
            this.flushPending();
        }
    }
    publish(subject, payload = encoders_1.Empty, options) {
        let data;
        if (payload instanceof Uint8Array) {
            data = payload;
        }
        else if (typeof payload === "string") {
            data = encoders_1.TE.encode(payload);
        }
        else {
            throw core_1.NatsError.errorForCode(core_1.ErrorCode.BadPayload);
        }
        let len = data.length;
        options = options || {};
        options.reply = options.reply || "";
        let headers = encoders_1.Empty;
        let hlen = 0;
        if (options.headers) {
            if (this.info && !this.info.headers) {
                throw new core_1.NatsError("headers", core_1.ErrorCode.ServerOptionNotAvailable);
            }
            const hdrs = options.headers;
            headers = hdrs.encode();
            hlen = headers.length;
            len = data.length + hlen;
        }
        if (this.info && len > this.info.max_payload) {
            throw core_1.NatsError.errorForCode(core_1.ErrorCode.MaxPayloadExceeded);
        }
        this.outBytes += len;
        this.outMsgs++;
        let proto;
        if (options.headers) {
            if (options.reply) {
                proto = `HPUB ${subject} ${options.reply} ${hlen} ${len}\r\n`;
            }
            else {
                proto = `HPUB ${subject} ${hlen} ${len}\r\n`;
            }
            this.sendCommand(proto, headers, data, transport_1.CRLF);
        }
        else {
            if (options.reply) {
                proto = `PUB ${subject} ${options.reply} ${len}\r\n`;
            }
            else {
                proto = `PUB ${subject} ${len}\r\n`;
            }
            this.sendCommand(proto, data, transport_1.CRLF);
        }
    }
    request(r) {
        this.initMux();
        this.muxSubscriptions.add(r);
        return r;
    }
    subscribe(s) {
        this.subscriptions.add(s);
        this._subunsub(s);
        return s;
    }
    _sub(s) {
        if (s.queue) {
            this.sendCommand(`SUB ${s.subject} ${s.queue} ${s.sid}\r\n`);
        }
        else {
            this.sendCommand(`SUB ${s.subject} ${s.sid}\r\n`);
        }
    }
    _subunsub(s) {
        this._sub(s);
        if (s.max) {
            this.unsubscribe(s, s.max);
        }
        return s;
    }
    unsubscribe(s, max) {
        this.unsub(s, max);
        if (s.max === undefined || s.received >= s.max) {
            this.subscriptions.cancel(s);
        }
    }
    unsub(s, max) {
        if (!s || this.isClosed()) {
            return;
        }
        if (max) {
            this.sendCommand(`UNSUB ${s.sid} ${max}\r\n`);
        }
        else {
            this.sendCommand(`UNSUB ${s.sid}\r\n`);
        }
        s.max = max;
    }
    resub(s, subject) {
        if (!s || this.isClosed()) {
            return;
        }
        this.unsub(s);
        s.subject = subject;
        this.subscriptions.resub(s);
        // we don't auto-unsub here because we don't
        // really know "processed"
        this._sub(s);
    }
    flush(p) {
        if (!p) {
            p = (0, util_1.deferred)();
        }
        this.pongs.push(p);
        this.outbound.fill(PING_CMD);
        this.flushPending();
        return p;
    }
    sendSubscriptions() {
        const cmds = [];
        this.subscriptions.all().forEach((s) => {
            const sub = s;
            if (sub.queue) {
                cmds.push(`SUB ${sub.subject} ${sub.queue} ${sub.sid}${transport_1.CR_LF}`);
            }
            else {
                cmds.push(`SUB ${sub.subject} ${sub.sid}${transport_1.CR_LF}`);
            }
        });
        if (cmds.length) {
            this.transport.send((0, encoders_1.encode)(cmds.join("")));
        }
    }
    _close(err) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._closed) {
                return;
            }
            this.whyClosed = new Error("close trace").stack || "";
            this.heartbeats.cancel();
            if (this.connectError) {
                this.connectError(err);
                this.connectError = undefined;
            }
            this.muxSubscriptions.close();
            this.subscriptions.close();
            this.listeners.forEach((l) => {
                l.stop();
            });
            this._closed = true;
            yield this.transport.close(err);
            yield this.closed.resolve(err);
        });
    }
    close() {
        return this._close();
    }
    isClosed() {
        return this._closed;
    }
    drain() {
        const subs = this.subscriptions.all();
        const promises = [];
        subs.forEach((sub) => {
            promises.push(sub.drain());
        });
        return Promise.all(promises)
            .then(() => __awaiter(this, void 0, void 0, function* () {
            this.noMorePublishing = true;
            yield this.flush();
            return this.close();
        }))
            .catch(() => {
            // cannot happen
        });
    }
    flushPending() {
        if (!this.infoReceived || !this.connected) {
            return;
        }
        if (this.outbound.size()) {
            const d = this.outbound.drain();
            this.transport.send(d);
        }
    }
    initMux() {
        const mux = this.subscriptions.getMux();
        if (!mux) {
            const inbox = this.muxSubscriptions.init(this.options.inboxPrefix);
            // dot is already part of mux
            const sub = new SubscriptionImpl(this, `${inbox}*`);
            sub.callback = this.muxSubscriptions.dispatcher();
            this.subscriptions.setMux(sub);
            this.subscribe(sub);
        }
    }
    selectServer() {
        const server = this.servers.selectServer();
        if (server === undefined) {
            return undefined;
        }
        // Place in client context.
        this.server = server;
        return this.server;
    }
    getServer() {
        return this.server;
    }
}
exports.ProtocolHandler = ProtocolHandler;
//# sourceMappingURL=protocol.js.map