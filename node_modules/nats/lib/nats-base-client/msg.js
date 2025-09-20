"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MsgImpl = void 0;
exports.isRequestError = isRequestError;
/*
 * Copyright 2020-2023 The NATS Authors
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
const headers_1 = require("./headers");
const encoders_1 = require("./encoders");
const codec_1 = require("./codec");
const core_1 = require("./core");
function isRequestError(msg) {
    var _a;
    // NATS core only considers errors 503s on messages that have no payload
    // everything else simply forwarded as part of the message and is considered
    // application level information
    if (msg && msg.data.length === 0 && ((_a = msg.headers) === null || _a === void 0 ? void 0 : _a.code) === 503) {
        return core_1.NatsError.errorForCode(core_1.ErrorCode.NoResponders);
    }
    return null;
}
class MsgImpl {
    constructor(msg, data, publisher) {
        this._msg = msg;
        this._rdata = data;
        this.publisher = publisher;
    }
    get subject() {
        if (this._subject) {
            return this._subject;
        }
        this._subject = encoders_1.TD.decode(this._msg.subject);
        return this._subject;
    }
    get reply() {
        if (this._reply) {
            return this._reply;
        }
        this._reply = encoders_1.TD.decode(this._msg.reply);
        return this._reply;
    }
    get sid() {
        return this._msg.sid;
    }
    get headers() {
        if (this._msg.hdr > -1 && !this._headers) {
            const buf = this._rdata.subarray(0, this._msg.hdr);
            this._headers = headers_1.MsgHdrsImpl.decode(buf);
        }
        return this._headers;
    }
    get data() {
        if (!this._rdata) {
            return new Uint8Array(0);
        }
        return this._msg.hdr > -1
            ? this._rdata.subarray(this._msg.hdr)
            : this._rdata;
    }
    // eslint-ignore-next-line @typescript-eslint/no-explicit-any
    respond(data = encoders_1.Empty, opts) {
        if (this.reply) {
            this.publisher.publish(this.reply, data, opts);
            return true;
        }
        return false;
    }
    size() {
        var _a;
        const subj = this._msg.subject.length;
        const reply = ((_a = this._msg.reply) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const payloadAndHeaders = this._msg.size === -1 ? 0 : this._msg.size;
        return subj + reply + payloadAndHeaders;
    }
    json(reviver) {
        return (0, codec_1.JSONCodec)(reviver).decode(this.data);
    }
    string() {
        return encoders_1.TD.decode(this.data);
    }
    requestInfo() {
        var _a;
        const v = (_a = this.headers) === null || _a === void 0 ? void 0 : _a.get("Nats-Request-Info");
        if (v) {
            return JSON.parse(v, function (key, value) {
                if ((key === "start" || key === "stop") && value !== "") {
                    return new Date(Date.parse(value));
                }
                return value;
            });
        }
        return null;
    }
}
exports.MsgImpl = MsgImpl;
//# sourceMappingURL=msg.js.map