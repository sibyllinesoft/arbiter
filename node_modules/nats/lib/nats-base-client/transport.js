"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LF = exports.CR = exports.CRLF = exports.CR_LF_LEN = exports.CR_LF = void 0;
exports.setTransportFactory = setTransportFactory;
exports.defaultPort = defaultPort;
exports.getUrlParseFn = getUrlParseFn;
exports.newTransport = newTransport;
exports.getResolveFn = getResolveFn;
exports.protoLen = protoLen;
exports.extractProtocolMessage = extractProtocolMessage;
/*
 * Copyright 2020-2021 The NATS Authors
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
const core_1 = require("./core");
const databuffer_1 = require("./databuffer");
let transportConfig;
function setTransportFactory(config) {
    transportConfig = config;
}
function defaultPort() {
    return transportConfig !== undefined &&
        transportConfig.defaultPort !== undefined
        ? transportConfig.defaultPort
        : core_1.DEFAULT_PORT;
}
function getUrlParseFn() {
    return transportConfig !== undefined && transportConfig.urlParseFn
        ? transportConfig.urlParseFn
        : undefined;
}
function newTransport() {
    if (!transportConfig || typeof transportConfig.factory !== "function") {
        throw new Error("transport fn is not set");
    }
    return transportConfig.factory();
}
function getResolveFn() {
    return transportConfig !== undefined && transportConfig.dnsResolveFn
        ? transportConfig.dnsResolveFn
        : undefined;
}
exports.CR_LF = "\r\n";
exports.CR_LF_LEN = exports.CR_LF.length;
exports.CRLF = databuffer_1.DataBuffer.fromAscii(exports.CR_LF);
exports.CR = new Uint8Array(exports.CRLF)[0]; // 13
exports.LF = new Uint8Array(exports.CRLF)[1]; // 10
function protoLen(ba) {
    for (let i = 0; i < ba.length; i++) {
        const n = i + 1;
        if (ba.byteLength > n && ba[i] === exports.CR && ba[n] === exports.LF) {
            return n + 1;
        }
    }
    return 0;
}
function extractProtocolMessage(a) {
    // protocol messages are ascii, so Uint8Array
    const len = protoLen(a);
    if (len > 0) {
        const ba = new Uint8Array(a);
        const out = ba.slice(0, len);
        return encoders_1.TD.decode(out);
    }
    return "";
}
//# sourceMappingURL=transport.js.map