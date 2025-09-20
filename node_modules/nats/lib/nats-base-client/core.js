"use strict";
/*
 * Copyright 2023 The NATS Authors
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
exports.ServiceVerb = exports.DEFAULT_HOST = exports.DEFAULT_PORT = exports.ServiceError = exports.ServiceErrorCodeHeader = exports.ServiceErrorHeader = exports.ServiceResponseType = exports.RequestStrategy = exports.Match = exports.NatsError = exports.Messages = exports.ErrorCode = exports.DebugEvents = exports.Events = void 0;
exports.isNatsError = isNatsError;
exports.syncIterator = syncIterator;
exports.createInbox = createInbox;
const nuid_1 = require("./nuid");
/**
 * Events reported by the {@link NatsConnection#status} iterator.
 */
var Events;
(function (Events) {
    /** Client disconnected */
    Events["Disconnect"] = "disconnect";
    /** Client reconnected */
    Events["Reconnect"] = "reconnect";
    /** Client received a cluster update */
    Events["Update"] = "update";
    /** Client received a signal telling it that the server is transitioning to Lame Duck Mode */
    Events["LDM"] = "ldm";
    /** Client received an async error from the server */
    Events["Error"] = "error";
})(Events || (exports.Events = Events = {}));
/**
 * Other events that can be reported by the {@link NatsConnection#status} iterator.
 * These can usually be safely ignored, as higher-order functionality of the client
 * will handle them.
 */
var DebugEvents;
(function (DebugEvents) {
    DebugEvents["Reconnecting"] = "reconnecting";
    DebugEvents["PingTimer"] = "pingTimer";
    DebugEvents["StaleConnection"] = "staleConnection";
    DebugEvents["ClientInitiatedReconnect"] = "client initiated reconnect";
})(DebugEvents || (exports.DebugEvents = DebugEvents = {}));
var ErrorCode;
(function (ErrorCode) {
    // emitted by the client
    ErrorCode["ApiError"] = "BAD API";
    ErrorCode["BadAuthentication"] = "BAD_AUTHENTICATION";
    ErrorCode["BadCreds"] = "BAD_CREDS";
    ErrorCode["BadHeader"] = "BAD_HEADER";
    ErrorCode["BadJson"] = "BAD_JSON";
    ErrorCode["BadPayload"] = "BAD_PAYLOAD";
    ErrorCode["BadSubject"] = "BAD_SUBJECT";
    ErrorCode["Cancelled"] = "CANCELLED";
    ErrorCode["ConnectionClosed"] = "CONNECTION_CLOSED";
    ErrorCode["ConnectionDraining"] = "CONNECTION_DRAINING";
    ErrorCode["ConnectionRefused"] = "CONNECTION_REFUSED";
    ErrorCode["ConnectionTimeout"] = "CONNECTION_TIMEOUT";
    ErrorCode["Disconnect"] = "DISCONNECT";
    ErrorCode["InvalidOption"] = "INVALID_OPTION";
    ErrorCode["InvalidPayload"] = "INVALID_PAYLOAD";
    ErrorCode["MaxPayloadExceeded"] = "MAX_PAYLOAD_EXCEEDED";
    ErrorCode["NoResponders"] = "503";
    ErrorCode["NotFunction"] = "NOT_FUNC";
    ErrorCode["RequestError"] = "REQUEST_ERROR";
    ErrorCode["ServerOptionNotAvailable"] = "SERVER_OPT_NA";
    ErrorCode["SubClosed"] = "SUB_CLOSED";
    ErrorCode["SubDraining"] = "SUB_DRAINING";
    ErrorCode["Timeout"] = "TIMEOUT";
    ErrorCode["Tls"] = "TLS";
    ErrorCode["Unknown"] = "UNKNOWN_ERROR";
    ErrorCode["WssRequired"] = "WSS_REQUIRED";
    // jetstream
    ErrorCode["JetStreamInvalidAck"] = "JESTREAM_INVALID_ACK";
    ErrorCode["JetStream404NoMessages"] = "404";
    ErrorCode["JetStream408RequestTimeout"] = "408";
    //@deprecated: use JetStream409
    ErrorCode["JetStream409MaxAckPendingExceeded"] = "409";
    ErrorCode["JetStream409"] = "409";
    ErrorCode["JetStreamNotEnabled"] = "503";
    ErrorCode["JetStreamIdleHeartBeat"] = "IDLE_HEARTBEAT";
    // emitted by the server
    ErrorCode["AuthorizationViolation"] = "AUTHORIZATION_VIOLATION";
    ErrorCode["AuthenticationExpired"] = "AUTHENTICATION_EXPIRED";
    ErrorCode["ProtocolError"] = "NATS_PROTOCOL_ERR";
    ErrorCode["PermissionsViolation"] = "PERMISSIONS_VIOLATION";
    ErrorCode["AuthenticationTimeout"] = "AUTHENTICATION_TIMEOUT";
    ErrorCode["AccountExpired"] = "ACCOUNT_EXPIRED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
function isNatsError(err) {
    return typeof err.code === "string";
}
class Messages {
    constructor() {
        this.messages = new Map();
        this.messages.set(ErrorCode.InvalidPayload, "Invalid payload type - payloads can be 'binary', 'string', or 'json'");
        this.messages.set(ErrorCode.BadJson, "Bad JSON");
        this.messages.set(ErrorCode.WssRequired, "TLS is required, therefore a secure websocket connection is also required");
    }
    static getMessage(s) {
        return messages.getMessage(s);
    }
    getMessage(s) {
        return this.messages.get(s) || s;
    }
}
exports.Messages = Messages;
// safari doesn't support static class members
const messages = new Messages();
class NatsError extends Error {
    /**
     * @param {String} message
     * @param {String} code
     * @param {Error} [chainedError]
     * @constructor
     *
     * @api private
     */
    constructor(message, code, chainedError) {
        super(message);
        this.name = "NatsError";
        this.message = message;
        this.code = code;
        this.chainedError = chainedError;
    }
    static errorForCode(code, chainedError) {
        const m = Messages.getMessage(code);
        return new NatsError(m, code, chainedError);
    }
    isAuthError() {
        return this.code === ErrorCode.AuthenticationExpired ||
            this.code === ErrorCode.AuthorizationViolation ||
            this.code === ErrorCode.AccountExpired;
    }
    isAuthTimeout() {
        return this.code === ErrorCode.AuthenticationTimeout;
    }
    isPermissionError() {
        return this.code === ErrorCode.PermissionsViolation;
    }
    isProtocolError() {
        return this.code === ErrorCode.ProtocolError;
    }
    isJetStreamError() {
        return this.api_error !== undefined;
    }
    jsError() {
        return this.api_error ? this.api_error : null;
    }
}
exports.NatsError = NatsError;
var Match;
(function (Match) {
    // Exact option is case sensitive
    Match[Match["Exact"] = 0] = "Exact";
    // Case sensitive, but key is transformed to Canonical MIME representation
    Match[Match["CanonicalMIME"] = 1] = "CanonicalMIME";
    // Case insensitive matches
    Match[Match["IgnoreCase"] = 2] = "IgnoreCase";
})(Match || (exports.Match = Match = {}));
var RequestStrategy;
(function (RequestStrategy) {
    RequestStrategy["Timer"] = "timer";
    RequestStrategy["Count"] = "count";
    RequestStrategy["JitterTimer"] = "jitterTimer";
    RequestStrategy["SentinelMsg"] = "sentinelMsg";
})(RequestStrategy || (exports.RequestStrategy = RequestStrategy = {}));
/**
 * syncIterator is a utility function that allows an AsyncIterator to be triggered
 * by calling next() - the utility will yield null if the underlying iterator is closed.
 * Note it is possibly an error to call use this function on an AsyncIterable that has
 * already been started (Symbol.asyncIterator() has been called) from a looping construct.
 */
function syncIterator(src) {
    const iter = src[Symbol.asyncIterator]();
    return {
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                const m = yield iter.next();
                if (m.done) {
                    return Promise.resolve(null);
                }
                return Promise.resolve(m.value);
            });
        },
    };
}
var ServiceResponseType;
(function (ServiceResponseType) {
    ServiceResponseType["STATS"] = "io.nats.micro.v1.stats_response";
    ServiceResponseType["INFO"] = "io.nats.micro.v1.info_response";
    ServiceResponseType["PING"] = "io.nats.micro.v1.ping_response";
})(ServiceResponseType || (exports.ServiceResponseType = ServiceResponseType = {}));
exports.ServiceErrorHeader = "Nats-Service-Error";
exports.ServiceErrorCodeHeader = "Nats-Service-Error-Code";
class ServiceError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
    static isServiceError(msg) {
        return ServiceError.toServiceError(msg) !== null;
    }
    static toServiceError(msg) {
        var _a, _b;
        const scode = ((_a = msg === null || msg === void 0 ? void 0 : msg.headers) === null || _a === void 0 ? void 0 : _a.get(exports.ServiceErrorCodeHeader)) || "";
        if (scode !== "") {
            const code = parseInt(scode) || 400;
            const description = ((_b = msg === null || msg === void 0 ? void 0 : msg.headers) === null || _b === void 0 ? void 0 : _b.get(exports.ServiceErrorHeader)) || "";
            return new ServiceError(code, description.length ? description : scode);
        }
        return null;
    }
}
exports.ServiceError = ServiceError;
function createInbox(prefix = "") {
    prefix = prefix || "_INBOX";
    if (typeof prefix !== "string") {
        throw (new Error("prefix must be a string"));
    }
    prefix.split(".")
        .forEach((v) => {
        if (v === "*" || v === ">") {
            throw new Error(`inbox prefixes cannot have wildcards '${prefix}'`);
        }
    });
    return `${prefix}.${nuid_1.nuid.next()}`;
}
exports.DEFAULT_PORT = 4222;
exports.DEFAULT_HOST = "127.0.0.1";
var ServiceVerb;
(function (ServiceVerb) {
    ServiceVerb["PING"] = "PING";
    ServiceVerb["STATS"] = "STATS";
    ServiceVerb["INFO"] = "INFO";
})(ServiceVerb || (exports.ServiceVerb = ServiceVerb = {}));
//# sourceMappingURL=core.js.map