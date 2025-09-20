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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RECONNECT_TIME_WAIT = exports.DEFAULT_MAX_PING_OUT = exports.DEFAULT_PING_INTERVAL = exports.DEFAULT_JITTER_TLS = exports.DEFAULT_JITTER = exports.DEFAULT_MAX_RECONNECT_ATTEMPTS = void 0;
exports.defaultOptions = defaultOptions;
exports.buildAuthenticator = buildAuthenticator;
exports.parseOptions = parseOptions;
exports.checkOptions = checkOptions;
exports.checkUnsupportedOption = checkUnsupportedOption;
const util_1 = require("./util");
const transport_1 = require("./transport");
const core_1 = require("./core");
const authenticator_1 = require("./authenticator");
const core_2 = require("./core");
exports.DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
exports.DEFAULT_JITTER = 100;
exports.DEFAULT_JITTER_TLS = 1000;
// Ping interval
exports.DEFAULT_PING_INTERVAL = 2 * 60 * 1000; // 2 minutes
exports.DEFAULT_MAX_PING_OUT = 2;
// DISCONNECT Parameters, 2 sec wait, 10 tries
exports.DEFAULT_RECONNECT_TIME_WAIT = 2 * 1000;
function defaultOptions() {
    return {
        maxPingOut: exports.DEFAULT_MAX_PING_OUT,
        maxReconnectAttempts: exports.DEFAULT_MAX_RECONNECT_ATTEMPTS,
        noRandomize: false,
        pedantic: false,
        pingInterval: exports.DEFAULT_PING_INTERVAL,
        reconnect: true,
        reconnectJitter: exports.DEFAULT_JITTER,
        reconnectJitterTLS: exports.DEFAULT_JITTER_TLS,
        reconnectTimeWait: exports.DEFAULT_RECONNECT_TIME_WAIT,
        tls: undefined,
        verbose: false,
        waitOnFirstConnect: false,
        ignoreAuthErrorAbort: false,
    };
}
function buildAuthenticator(opts) {
    const buf = [];
    // jwtAuthenticator is created by the user, since it
    // will require possibly reading files which
    // some of the clients are simply unable to do
    if (typeof opts.authenticator === "function") {
        buf.push(opts.authenticator);
    }
    if (Array.isArray(opts.authenticator)) {
        buf.push(...opts.authenticator);
    }
    if (opts.token) {
        buf.push((0, authenticator_1.tokenAuthenticator)(opts.token));
    }
    if (opts.user) {
        buf.push((0, authenticator_1.usernamePasswordAuthenticator)(opts.user, opts.pass));
    }
    return buf.length === 0 ? (0, authenticator_1.noAuthFn)() : (0, authenticator_1.multiAuthenticator)(buf);
}
function parseOptions(opts) {
    const dhp = `${core_2.DEFAULT_HOST}:${(0, transport_1.defaultPort)()}`;
    opts = opts || { servers: [dhp] };
    opts.servers = opts.servers || [];
    if (typeof opts.servers === "string") {
        opts.servers = [opts.servers];
    }
    if (opts.servers.length > 0 && opts.port) {
        throw new core_2.NatsError("port and servers options are mutually exclusive", core_2.ErrorCode.InvalidOption);
    }
    if (opts.servers.length === 0 && opts.port) {
        opts.servers = [`${core_2.DEFAULT_HOST}:${opts.port}`];
    }
    if (opts.servers && opts.servers.length === 0) {
        opts.servers = [dhp];
    }
    const options = (0, util_1.extend)(defaultOptions(), opts);
    options.authenticator = buildAuthenticator(options);
    ["reconnectDelayHandler", "authenticator"].forEach((n) => {
        if (options[n] && typeof options[n] !== "function") {
            throw new core_2.NatsError(`${n} option should be a function`, core_2.ErrorCode.NotFunction);
        }
    });
    if (!options.reconnectDelayHandler) {
        options.reconnectDelayHandler = () => {
            let extra = options.tls
                ? options.reconnectJitterTLS
                : options.reconnectJitter;
            if (extra) {
                extra++;
                extra = Math.floor(Math.random() * extra);
            }
            return options.reconnectTimeWait + extra;
        };
    }
    if (options.inboxPrefix) {
        try {
            (0, core_1.createInbox)(options.inboxPrefix);
        }
        catch (err) {
            throw new core_2.NatsError(err.message, core_2.ErrorCode.ApiError);
        }
    }
    // if not set - we set it
    if (options.resolve === undefined) {
        // set a default based on whether the client can resolve or not
        options.resolve = typeof (0, transport_1.getResolveFn)() === "function";
    }
    if (options.resolve) {
        if (typeof (0, transport_1.getResolveFn)() !== "function") {
            throw new core_2.NatsError(`'resolve' is not supported on this client`, core_2.ErrorCode.InvalidOption);
        }
    }
    return options;
}
function checkOptions(info, options) {
    const { proto, tls_required: tlsRequired, tls_available: tlsAvailable } = info;
    if ((proto === undefined || proto < 1) && options.noEcho) {
        throw new core_2.NatsError("noEcho", core_2.ErrorCode.ServerOptionNotAvailable);
    }
    const tls = tlsRequired || tlsAvailable || false;
    if (options.tls && !tls) {
        throw new core_2.NatsError("tls", core_2.ErrorCode.ServerOptionNotAvailable);
    }
}
function checkUnsupportedOption(prop, v) {
    if (v) {
        throw new core_2.NatsError(prop, core_2.ErrorCode.InvalidOption);
    }
}
//# sourceMappingURL=options.js.map