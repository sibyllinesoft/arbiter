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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeTransport = void 0;
exports.nodeResolveHost = nodeResolveHost;
/*
 * Copyright 2020-2024 The NATS Authors
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
const nats_base_client_1 = require("./nats-base-client");
const net_1 = require("net");
const util_1 = require("../nats-base-client/util");
const tls_1 = require("tls");
const { resolve } = require("path");
const { readFile, existsSync } = require("fs");
const dns = require("dns");
const VERSION = "2.29.3";
const LANG = "nats.js";
class NodeTransport {
    constructor() {
        this.yields = [];
        this.signal = (0, nats_base_client_1.deferred)();
        this.closedNotification = (0, nats_base_client_1.deferred)();
        this.connected = false;
        this.tlsName = "";
        this.done = false;
        this.lang = LANG;
        this.version = VERSION;
    }
    connect(hp, options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.tlsName = hp.tlsName;
            this.options = options;
            const { tls } = this.options;
            const { handshakeFirst } = tls || {};
            try {
                if (handshakeFirst === true) {
                    this.socket = yield this.tlsFirst(hp);
                }
                else {
                    this.socket = yield this.dial(hp);
                }
                const info = yield this.peekInfo();
                (0, nats_base_client_1.checkOptions)(info, options);
                const { tls_required: tlsRequired, tls_available: tlsAvailable } = info;
                const desired = tlsAvailable === true && options.tls !== null;
                if (!handshakeFirst && (tlsRequired || desired)) {
                    this.socket = yield this.startTLS();
                }
                //@ts-ignore: this is possibly a TlsSocket
                if (tlsRequired && this.socket.encrypted !== true) {
                    throw new nats_base_client_1.NatsError("tls", nats_base_client_1.ErrorCode.ServerOptionNotAvailable);
                }
                this.connected = true;
                this.setupHandlers();
                this.signal.resolve();
                return Promise.resolve();
            }
            catch (err) {
                if (!err) {
                    // this seems to be possible in Kubernetes
                    // where an error is thrown, but it is undefined
                    // when something like istio-init is booting up
                    err = nats_base_client_1.NatsError.errorForCode(nats_base_client_1.ErrorCode.ConnectionRefused, new Error("node provided an undefined error!"));
                }
                const { code } = err;
                const perr = code === "ECONNREFUSED"
                    ? nats_base_client_1.NatsError.errorForCode(nats_base_client_1.ErrorCode.ConnectionRefused, err)
                    : err;
                if (this.socket) {
                    this.socket.destroy();
                }
                throw perr;
            }
        });
    }
    dial(hp) {
        const d = (0, nats_base_client_1.deferred)();
        let dialError;
        const socket = (0, net_1.createConnection)(hp.port, hp.hostname, () => {
            d.resolve(socket);
            socket.removeAllListeners();
        });
        socket.on("error", (err) => {
            dialError = err;
        });
        socket.on("close", () => {
            socket.removeAllListeners();
            d.reject(dialError);
        });
        socket.setNoDelay(true);
        return d;
    }
    get isClosed() {
        return this.done;
    }
    close(err) {
        return this._closed(err, false);
    }
    peekInfo() {
        const d = (0, nats_base_client_1.deferred)();
        let peekError;
        this.socket.on("data", (frame) => {
            this.yields.push(frame);
            const t = nats_base_client_1.DataBuffer.concat(...this.yields);
            const pm = (0, nats_base_client_1.extractProtocolMessage)(t);
            if (pm !== "") {
                try {
                    const m = nats_base_client_1.INFO.exec(pm);
                    if (!m) {
                        throw new Error("unexpected response from server");
                    }
                    const info = JSON.parse(m[1]);
                    d.resolve(info);
                }
                catch (err) {
                    d.reject(err);
                }
                finally {
                    this.socket.removeAllListeners();
                }
            }
        });
        this.socket.on("error", (err) => {
            peekError = err;
        });
        this.socket.on("close", () => {
            this.socket.removeAllListeners();
            d.reject(peekError);
        });
        return d;
    }
    loadFile(fn) {
        if (!fn) {
            return Promise.resolve();
        }
        const d = (0, nats_base_client_1.deferred)();
        try {
            fn = resolve(fn);
            if (!existsSync(fn)) {
                d.reject(new Error(`${fn} doesn't exist`));
            }
            readFile(fn, (err, data) => {
                if (err) {
                    return d.reject(err);
                }
                d.resolve(data);
            });
        }
        catch (err) {
            d.reject(err);
        }
        return d;
    }
    loadClientCerts() {
        return __awaiter(this, void 0, void 0, function* () {
            const tlsOpts = {};
            const { certFile, cert, caFile, ca, keyFile, key } = this.options.tls;
            try {
                if (certFile) {
                    const data = yield this.loadFile(certFile);
                    if (data) {
                        tlsOpts.cert = data;
                    }
                }
                else if (cert) {
                    tlsOpts.cert = cert;
                }
                if (keyFile) {
                    const data = yield this.loadFile(keyFile);
                    if (data) {
                        tlsOpts.key = data;
                    }
                }
                else if (key) {
                    tlsOpts.key = key;
                }
                if (caFile) {
                    const data = yield this.loadFile(caFile);
                    if (data) {
                        tlsOpts.ca = [data];
                    }
                }
                else if (ca) {
                    tlsOpts.ca = ca;
                }
                return Promise.resolve(tlsOpts);
            }
            catch (err) {
                return Promise.reject(err);
            }
        });
    }
    tlsFirst(hp) {
        return __awaiter(this, void 0, void 0, function* () {
            let tlsError;
            let tlsOpts = {
                servername: this.tlsName,
                rejectUnauthorized: true,
            };
            if (this.socket) {
                tlsOpts.socket = this.socket;
            }
            if (typeof this.options.tls === "object") {
                try {
                    const certOpts = (yield this.loadClientCerts()) || {};
                    tlsOpts = (0, util_1.extend)(tlsOpts, this.options.tls, certOpts);
                }
                catch (err) {
                    return Promise.reject(new nats_base_client_1.NatsError(err.message, nats_base_client_1.ErrorCode.Tls, err));
                }
            }
            const d = (0, nats_base_client_1.deferred)();
            try {
                const tlsSocket = (0, tls_1.connect)(hp.port, hp.hostname, tlsOpts, () => {
                    tlsSocket.removeAllListeners();
                    d.resolve(tlsSocket);
                });
                tlsSocket.on("error", (err) => {
                    tlsError = err;
                });
                tlsSocket.on("secureConnect", () => {
                    // socket won't be authorized, if the user disabled it
                    if (tlsOpts.rejectUnauthorized === false) {
                        return;
                    }
                    if (!tlsSocket.authorized) {
                        throw tlsSocket.authorizationError;
                    }
                });
                tlsSocket.on("close", () => {
                    d.reject(tlsError);
                    tlsSocket.removeAllListeners();
                });
                tlsSocket.setNoDelay(true);
            }
            catch (err) {
                // tls throws errors on bad certs see nats.js#310
                d.reject(nats_base_client_1.NatsError.errorForCode(nats_base_client_1.ErrorCode.Tls, err));
            }
            return d;
        });
    }
    startTLS() {
        return __awaiter(this, void 0, void 0, function* () {
            let tlsError;
            let tlsOpts = {
                socket: this.socket,
                servername: this.tlsName,
                rejectUnauthorized: true,
            };
            if (typeof this.options.tls === "object") {
                try {
                    const certOpts = (yield this.loadClientCerts()) || {};
                    tlsOpts = (0, util_1.extend)(tlsOpts, this.options.tls, certOpts);
                }
                catch (err) {
                    return Promise.reject(new nats_base_client_1.NatsError(err.message, nats_base_client_1.ErrorCode.Tls, err));
                }
            }
            const d = (0, nats_base_client_1.deferred)();
            try {
                const tlsSocket = (0, tls_1.connect)(tlsOpts, () => {
                    tlsSocket.removeAllListeners();
                    d.resolve(tlsSocket);
                });
                tlsSocket.on("error", (err) => {
                    tlsError = err;
                });
                tlsSocket.on("secureConnect", () => {
                    // socket won't be authorized, if the user disabled it
                    if (tlsOpts.rejectUnauthorized === false) {
                        return;
                    }
                    if (!tlsSocket.authorized) {
                        throw tlsSocket.authorizationError;
                    }
                });
                tlsSocket.on("close", () => {
                    d.reject(tlsError);
                    tlsSocket.removeAllListeners();
                });
            }
            catch (err) {
                // tls throws errors on bad certs see nats.js#310
                d.reject(nats_base_client_1.NatsError.errorForCode(nats_base_client_1.ErrorCode.Tls, err));
            }
            return d;
        });
    }
    setupHandlers() {
        let connError;
        this.socket.on("data", (frame) => {
            this.yields.push(frame);
            return this.signal.resolve();
        });
        this.socket.on("error", (err) => {
            connError = err;
        });
        this.socket.on("end", () => {
            var _a, _b;
            if ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.destroyed) {
                return;
            }
            (_b = this.socket) === null || _b === void 0 ? void 0 : _b.write(new Uint8Array(0), () => {
                var _a;
                (_a = this.socket) === null || _a === void 0 ? void 0 : _a.end();
            });
        });
        this.socket.on("close", () => {
            this._closed(connError, false);
        });
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
    iterate() {
        return __asyncGenerator(this, arguments, function* iterate_1() {
            const debug = this.options.debug;
            while (true) {
                if (this.yields.length === 0) {
                    yield __await(this.signal);
                }
                const yields = this.yields;
                this.yields = [];
                for (let i = 0; i < yields.length; i++) {
                    if (debug) {
                        console.info(`> ${(0, nats_base_client_1.render)(yields[i])}`);
                    }
                    yield yield __await(yields[i]);
                }
                // yielding could have paused and microtask
                // could have added messages. Prevent allocations
                // if possible
                if (this.done) {
                    break;
                }
                else if (this.yields.length === 0) {
                    yields.length = 0;
                    this.yields = yields;
                    this.signal = (0, nats_base_client_1.deferred)();
                }
            }
        });
    }
    discard() {
        // ignored - this is not required, as there's no throttling
    }
    disconnect() {
        this._closed(undefined, true).then().catch();
    }
    isEncrypted() {
        return this.socket instanceof tls_1.TLSSocket;
    }
    _send(frame) {
        if (this.isClosed || this.socket === undefined) {
            return Promise.resolve();
        }
        if (this.options.debug) {
            console.info(`< ${(0, nats_base_client_1.render)(frame)}`);
        }
        const d = (0, nats_base_client_1.deferred)();
        try {
            this.socket.write(frame, (err) => {
                if (err) {
                    if (this.options.debug) {
                        console.error(`!!! ${(0, nats_base_client_1.render)(frame)}: ${err}`);
                    }
                    return d.reject(err);
                }
                return d.resolve();
            });
        }
        catch (err) {
            if (this.options.debug) {
                console.error(`!!! ${(0, nats_base_client_1.render)(frame)}: ${err}`);
            }
            d.reject(err);
        }
        return d;
    }
    send(frame) {
        const p = this._send(frame);
        p.catch((_err) => {
            // we ignore write errors because client will
            // fail on a read or when the heartbeat timer
            // detects a stale connection
        });
    }
    _closed(err_1) {
        return __awaiter(this, arguments, void 0, function* (err, internal = true) {
            // if this connection didn't succeed, then ignore it.
            if (!this.connected)
                return;
            if (this.done)
                return;
            this.closeError = err;
            // only try to flush the outbound buffer if we got no error and
            // the close is internal, if the transport closed, we are done.
            if (!err && this.socket && internal) {
                try {
                    yield this._send(new TextEncoder().encode(""));
                }
                catch (err) {
                    if (this.options.debug) {
                        console.log("transport close terminated with an error", err);
                    }
                }
            }
            try {
                if (this.socket) {
                    this.socket.removeAllListeners();
                    this.socket.destroy();
                    this.socket = undefined;
                }
            }
            catch (err) {
                console.log(err);
            }
            this.done = true;
            this.closedNotification.resolve(this.closeError);
        });
    }
    closed() {
        return this.closedNotification;
    }
}
exports.NodeTransport = NodeTransport;
function nodeResolveHost(s) {
    return __awaiter(this, void 0, void 0, function* () {
        const a = (0, nats_base_client_1.deferred)();
        const aaaa = (0, nats_base_client_1.deferred)();
        dns.resolve4(s, (err, records) => {
            if (err) {
                a.resolve(err);
            }
            else {
                a.resolve(records);
            }
        });
        dns.resolve6(s, (err, records) => {
            if (err) {
                aaaa.resolve(err);
            }
            else {
                aaaa.resolve(records);
            }
        });
        const ips = [];
        const da = yield a;
        if (Array.isArray(da)) {
            ips.push(...da);
        }
        const daaaa = yield aaaa;
        if (Array.isArray(daaaa)) {
            ips.push(...daaaa);
        }
        if (ips.length === 0) {
            ips.push(s);
        }
        return ips;
    });
}
//# sourceMappingURL=node_transport.js.map