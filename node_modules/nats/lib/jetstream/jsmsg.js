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
exports.JsMsgImpl = exports.ACK = void 0;
exports.toJsMsg = toJsMsg;
exports.parseInfo = parseInfo;
/*
 * Copyright 2021-2024 The NATS Authors
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
const databuffer_1 = require("../nats-base-client/databuffer");
const codec_1 = require("../nats-base-client/codec");
const request_1 = require("../nats-base-client/request");
const mod_1 = require("../nats-base-client/mod");
const util_1 = require("../nats-base-client/util");
exports.ACK = Uint8Array.of(43, 65, 67, 75);
const NAK = Uint8Array.of(45, 78, 65, 75);
const WPI = Uint8Array.of(43, 87, 80, 73);
const NXT = Uint8Array.of(43, 78, 88, 84);
const TERM = Uint8Array.of(43, 84, 69, 82, 77);
const SPACE = Uint8Array.of(32);
function toJsMsg(m, ackTimeout = 5000) {
    return new JsMsgImpl(m, ackTimeout);
}
function parseInfo(s) {
    const tokens = s.split(".");
    if (tokens.length === 9) {
        tokens.splice(2, 0, "_", "");
    }
    if ((tokens.length < 11) || tokens[0] !== "$JS" || tokens[1] !== "ACK") {
        throw new Error(`not js message`);
    }
    // old
    // "$JS.ACK.<stream>.<consumer>.<deliveryCount><streamSeq><deliverySequence>.<timestamp>.<pending>"
    // new
    // $JS.ACK.<domain>.<accounthash>.<stream>.<consumer>.<deliveryCount>.<streamSeq>.<deliverySequence>.<timestamp>.<pending>.<random>
    const di = {};
    // if domain is "_", replace with blank
    di.domain = tokens[2] === "_" ? "" : tokens[2];
    di.account_hash = tokens[3];
    di.stream = tokens[4];
    di.consumer = tokens[5];
    di.deliveryCount = parseInt(tokens[6], 10);
    di.redeliveryCount = di.deliveryCount;
    di.redelivered = di.deliveryCount > 1;
    di.streamSequence = parseInt(tokens[7], 10);
    di.deliverySequence = parseInt(tokens[8], 10);
    di.timestampNanos = parseInt(tokens[9], 10);
    di.pending = parseInt(tokens[10], 10);
    return di;
}
class JsMsgImpl {
    constructor(msg, timeout) {
        this.msg = msg;
        this.didAck = false;
        this.timeout = timeout;
    }
    get subject() {
        return this.msg.subject;
    }
    get sid() {
        return this.msg.sid;
    }
    get data() {
        return this.msg.data;
    }
    get headers() {
        return this.msg.headers;
    }
    get info() {
        if (!this.di) {
            this.di = parseInfo(this.reply);
        }
        return this.di;
    }
    get redelivered() {
        return this.info.deliveryCount > 1;
    }
    get reply() {
        return this.msg.reply || "";
    }
    get seq() {
        return this.info.streamSequence;
    }
    doAck(payload) {
        if (!this.didAck) {
            // all acks are final with the exception of +WPI
            this.didAck = !this.isWIP(payload);
            this.msg.respond(payload);
        }
    }
    isWIP(p) {
        return p.length === 4 && p[0] === WPI[0] && p[1] === WPI[1] &&
            p[2] === WPI[2] && p[3] === WPI[3];
    }
    // this has to dig into the internals as the message has access
    // to the protocol but not the high-level client.
    ackAck(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            opts = opts || {};
            opts.timeout = opts.timeout || this.timeout;
            const d = (0, mod_1.deferred)();
            if (!this.didAck) {
                this.didAck = true;
                if (this.msg.reply) {
                    const mi = this.msg;
                    const proto = mi.publisher;
                    const trace = !(((_a = proto.options) === null || _a === void 0 ? void 0 : _a.noAsyncTraces) || false);
                    const r = new request_1.RequestOne(proto.muxSubscriptions, this.msg.reply, {
                        timeout: opts.timeout,
                    }, trace);
                    proto.request(r);
                    try {
                        proto.publish(this.msg.reply, exports.ACK, {
                            reply: `${proto.muxSubscriptions.baseInbox}${r.token}`,
                        });
                    }
                    catch (err) {
                        r.cancel(err);
                    }
                    try {
                        yield Promise.race([r.timer, r.deferred]);
                        d.resolve(true);
                    }
                    catch (err) {
                        r.cancel(err);
                        d.reject(err);
                    }
                }
                else {
                    d.resolve(false);
                }
            }
            else {
                d.resolve(false);
            }
            return d;
        });
    }
    ack() {
        this.doAck(exports.ACK);
    }
    nak(millis) {
        let payload = NAK;
        if (millis) {
            payload = (0, codec_1.StringCodec)().encode(`-NAK ${JSON.stringify({ delay: (0, util_1.nanos)(millis) })}`);
        }
        this.doAck(payload);
    }
    working() {
        this.doAck(WPI);
    }
    next(subj, opts = { batch: 1 }) {
        const args = {};
        args.batch = opts.batch || 1;
        args.no_wait = opts.no_wait || false;
        if (opts.expires && opts.expires > 0) {
            args.expires = (0, util_1.nanos)(opts.expires);
        }
        const data = (0, codec_1.JSONCodec)().encode(args);
        const payload = databuffer_1.DataBuffer.concat(NXT, SPACE, data);
        const reqOpts = subj ? { reply: subj } : undefined;
        this.msg.respond(payload, reqOpts);
    }
    term(reason = "") {
        let term = TERM;
        if ((reason === null || reason === void 0 ? void 0 : reason.length) > 0) {
            term = (0, codec_1.StringCodec)().encode(`+TERM ${reason}`);
        }
        this.doAck(term);
    }
    json() {
        return this.msg.json();
    }
    string() {
        return this.msg.string();
    }
}
exports.JsMsgImpl = JsMsgImpl;
//# sourceMappingURL=jsmsg.js.map