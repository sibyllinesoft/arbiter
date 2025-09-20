"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = exports.Parser = exports.Kind = void 0;
exports.describe = describe;
// deno-lint-ignore-file no-undef
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
const denobuffer_1 = require("./denobuffer");
const encoders_1 = require("./encoders");
var Kind;
(function (Kind) {
    Kind[Kind["OK"] = 0] = "OK";
    Kind[Kind["ERR"] = 1] = "ERR";
    Kind[Kind["MSG"] = 2] = "MSG";
    Kind[Kind["INFO"] = 3] = "INFO";
    Kind[Kind["PING"] = 4] = "PING";
    Kind[Kind["PONG"] = 5] = "PONG";
})(Kind || (exports.Kind = Kind = {}));
function describe(e) {
    let ks;
    let data = "";
    switch (e.kind) {
        case Kind.MSG:
            ks = "MSG";
            break;
        case Kind.OK:
            ks = "OK";
            break;
        case Kind.ERR:
            ks = "ERR";
            data = encoders_1.TD.decode(e.data);
            break;
        case Kind.PING:
            ks = "PING";
            break;
        case Kind.PONG:
            ks = "PONG";
            break;
        case Kind.INFO:
            ks = "INFO";
            data = encoders_1.TD.decode(e.data);
    }
    return `${ks}: ${data}`;
}
function newMsgArg() {
    const ma = {};
    ma.sid = -1;
    ma.hdr = -1;
    ma.size = -1;
    return ma;
}
const ASCII_0 = 48;
const ASCII_9 = 57;
// This is an almost verbatim port of the Go NATS parser
// https://github.com/nats-io/nats.go/blob/master/parser.go
class Parser {
    constructor(dispatcher) {
        this.dispatcher = dispatcher;
        this.state = State.OP_START;
        this.as = 0;
        this.drop = 0;
        this.hdr = 0;
    }
    parse(buf) {
        let i;
        for (i = 0; i < buf.length; i++) {
            const b = buf[i];
            switch (this.state) {
                case State.OP_START:
                    switch (b) {
                        case cc.M:
                        case cc.m:
                            this.state = State.OP_M;
                            this.hdr = -1;
                            this.ma = newMsgArg();
                            break;
                        case cc.H:
                        case cc.h:
                            this.state = State.OP_H;
                            this.hdr = 0;
                            this.ma = newMsgArg();
                            break;
                        case cc.P:
                        case cc.p:
                            this.state = State.OP_P;
                            break;
                        case cc.PLUS:
                            this.state = State.OP_PLUS;
                            break;
                        case cc.MINUS:
                            this.state = State.OP_MINUS;
                            break;
                        case cc.I:
                        case cc.i:
                            this.state = State.OP_I;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_H:
                    switch (b) {
                        case cc.M:
                        case cc.m:
                            this.state = State.OP_M;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_M:
                    switch (b) {
                        case cc.S:
                        case cc.s:
                            this.state = State.OP_MS;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MS:
                    switch (b) {
                        case cc.G:
                        case cc.g:
                            this.state = State.OP_MSG;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MSG:
                    switch (b) {
                        case cc.SPACE:
                        case cc.TAB:
                            this.state = State.OP_MSG_SPC;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MSG_SPC:
                    switch (b) {
                        case cc.SPACE:
                        case cc.TAB:
                            continue;
                        default:
                            this.state = State.MSG_ARG;
                            this.as = i;
                    }
                    break;
                case State.MSG_ARG:
                    switch (b) {
                        case cc.CR:
                            this.drop = 1;
                            break;
                        case cc.NL: {
                            const arg = this.argBuf
                                ? this.argBuf.bytes()
                                : buf.subarray(this.as, i - this.drop);
                            this.processMsgArgs(arg);
                            this.drop = 0;
                            this.as = i + 1;
                            this.state = State.MSG_PAYLOAD;
                            // jump ahead with the index. If this overruns
                            // what is left we fall out and process a split buffer.
                            i = this.as + this.ma.size - 1;
                            break;
                        }
                        default:
                            if (this.argBuf) {
                                this.argBuf.writeByte(b);
                            }
                    }
                    break;
                case State.MSG_PAYLOAD:
                    if (this.msgBuf) {
                        if (this.msgBuf.length >= this.ma.size) {
                            const data = this.msgBuf.bytes({ copy: false });
                            this.dispatcher.push({ kind: Kind.MSG, msg: this.ma, data: data });
                            this.argBuf = undefined;
                            this.msgBuf = undefined;
                            this.state = State.MSG_END;
                        }
                        else {
                            let toCopy = this.ma.size - this.msgBuf.length;
                            const avail = buf.length - i;
                            if (avail < toCopy) {
                                toCopy = avail;
                            }
                            if (toCopy > 0) {
                                this.msgBuf.write(buf.subarray(i, i + toCopy));
                                i = (i + toCopy) - 1;
                            }
                            else {
                                this.msgBuf.writeByte(b);
                            }
                        }
                    }
                    else if (i - this.as >= this.ma.size) {
                        this.dispatcher.push({ kind: Kind.MSG, msg: this.ma, data: buf.subarray(this.as, i) });
                        this.argBuf = undefined;
                        this.msgBuf = undefined;
                        this.state = State.MSG_END;
                    }
                    break;
                case State.MSG_END:
                    switch (b) {
                        case cc.NL:
                            this.drop = 0;
                            this.as = i + 1;
                            this.state = State.OP_START;
                            break;
                        default:
                            continue;
                    }
                    break;
                case State.OP_PLUS:
                    switch (b) {
                        case cc.O:
                        case cc.o:
                            this.state = State.OP_PLUS_O;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PLUS_O:
                    switch (b) {
                        case cc.K:
                        case cc.k:
                            this.state = State.OP_PLUS_OK;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PLUS_OK:
                    switch (b) {
                        case cc.NL:
                            this.dispatcher.push({ kind: Kind.OK });
                            this.drop = 0;
                            this.state = State.OP_START;
                            break;
                    }
                    break;
                case State.OP_MINUS:
                    switch (b) {
                        case cc.E:
                        case cc.e:
                            this.state = State.OP_MINUS_E;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MINUS_E:
                    switch (b) {
                        case cc.R:
                        case cc.r:
                            this.state = State.OP_MINUS_ER;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MINUS_ER:
                    switch (b) {
                        case cc.R:
                        case cc.r:
                            this.state = State.OP_MINUS_ERR;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MINUS_ERR:
                    switch (b) {
                        case cc.SPACE:
                        case cc.TAB:
                            this.state = State.OP_MINUS_ERR_SPC;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_MINUS_ERR_SPC:
                    switch (b) {
                        case cc.SPACE:
                        case cc.TAB:
                            continue;
                        default:
                            this.state = State.MINUS_ERR_ARG;
                            this.as = i;
                    }
                    break;
                case State.MINUS_ERR_ARG:
                    switch (b) {
                        case cc.CR:
                            this.drop = 1;
                            break;
                        case cc.NL: {
                            let arg;
                            if (this.argBuf) {
                                arg = this.argBuf.bytes();
                                this.argBuf = undefined;
                            }
                            else {
                                arg = buf.subarray(this.as, i - this.drop);
                            }
                            this.dispatcher.push({ kind: Kind.ERR, data: arg });
                            this.drop = 0;
                            this.as = i + 1;
                            this.state = State.OP_START;
                            break;
                        }
                        default:
                            if (this.argBuf) {
                                this.argBuf.write(Uint8Array.of(b));
                            }
                    }
                    break;
                case State.OP_P:
                    switch (b) {
                        case cc.I:
                        case cc.i:
                            this.state = State.OP_PI;
                            break;
                        case cc.O:
                        case cc.o:
                            this.state = State.OP_PO;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PO:
                    switch (b) {
                        case cc.N:
                        case cc.n:
                            this.state = State.OP_PON;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PON:
                    switch (b) {
                        case cc.G:
                        case cc.g:
                            this.state = State.OP_PONG;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PONG:
                    switch (b) {
                        case cc.NL:
                            this.dispatcher.push({ kind: Kind.PONG });
                            this.drop = 0;
                            this.state = State.OP_START;
                            break;
                    }
                    break;
                case State.OP_PI:
                    switch (b) {
                        case cc.N:
                        case cc.n:
                            this.state = State.OP_PIN;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PIN:
                    switch (b) {
                        case cc.G:
                        case cc.g:
                            this.state = State.OP_PING;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_PING:
                    switch (b) {
                        case cc.NL:
                            this.dispatcher.push({ kind: Kind.PING });
                            this.drop = 0;
                            this.state = State.OP_START;
                            break;
                    }
                    break;
                case State.OP_I:
                    switch (b) {
                        case cc.N:
                        case cc.n:
                            this.state = State.OP_IN;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_IN:
                    switch (b) {
                        case cc.F:
                        case cc.f:
                            this.state = State.OP_INF;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_INF:
                    switch (b) {
                        case cc.O:
                        case cc.o:
                            this.state = State.OP_INFO;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_INFO:
                    switch (b) {
                        case cc.SPACE:
                        case cc.TAB:
                            this.state = State.OP_INFO_SPC;
                            break;
                        default:
                            throw this.fail(buf.subarray(i));
                    }
                    break;
                case State.OP_INFO_SPC:
                    switch (b) {
                        case cc.SPACE:
                        case cc.TAB:
                            continue;
                        default:
                            this.state = State.INFO_ARG;
                            this.as = i;
                    }
                    break;
                case State.INFO_ARG:
                    switch (b) {
                        case cc.CR:
                            this.drop = 1;
                            break;
                        case cc.NL: {
                            let arg;
                            if (this.argBuf) {
                                arg = this.argBuf.bytes();
                                this.argBuf = undefined;
                            }
                            else {
                                arg = buf.subarray(this.as, i - this.drop);
                            }
                            this.dispatcher.push({ kind: Kind.INFO, data: arg });
                            this.drop = 0;
                            this.as = i + 1;
                            this.state = State.OP_START;
                            break;
                        }
                        default:
                            if (this.argBuf) {
                                this.argBuf.writeByte(b);
                            }
                    }
                    break;
                default:
                    throw this.fail(buf.subarray(i));
            }
        }
        if ((this.state === State.MSG_ARG || this.state === State.MINUS_ERR_ARG ||
            this.state === State.INFO_ARG) && !this.argBuf) {
            this.argBuf = new denobuffer_1.DenoBuffer(buf.subarray(this.as, i - this.drop));
        }
        if (this.state === State.MSG_PAYLOAD && !this.msgBuf) {
            if (!this.argBuf) {
                this.cloneMsgArg();
            }
            this.msgBuf = new denobuffer_1.DenoBuffer(buf.subarray(this.as));
        }
    }
    cloneMsgArg() {
        const s = this.ma.subject.length;
        const r = this.ma.reply ? this.ma.reply.length : 0;
        const buf = new Uint8Array(s + r);
        buf.set(this.ma.subject);
        if (this.ma.reply) {
            buf.set(this.ma.reply, s);
        }
        this.argBuf = new denobuffer_1.DenoBuffer(buf);
        this.ma.subject = buf.subarray(0, s);
        if (this.ma.reply) {
            this.ma.reply = buf.subarray(s);
        }
    }
    processMsgArgs(arg) {
        if (this.hdr >= 0) {
            return this.processHeaderMsgArgs(arg);
        }
        const args = [];
        let start = -1;
        for (let i = 0; i < arg.length; i++) {
            const b = arg[i];
            switch (b) {
                case cc.SPACE:
                case cc.TAB:
                case cc.CR:
                case cc.NL:
                    if (start >= 0) {
                        args.push(arg.subarray(start, i));
                        start = -1;
                    }
                    break;
                default:
                    if (start < 0) {
                        start = i;
                    }
            }
        }
        if (start >= 0) {
            args.push(arg.subarray(start));
        }
        switch (args.length) {
            case 3:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = undefined;
                this.ma.size = this.protoParseInt(args[2]);
                break;
            case 4:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = args[2];
                this.ma.size = this.protoParseInt(args[3]);
                break;
            default:
                throw this.fail(arg, "processMsgArgs Parse Error");
        }
        if (this.ma.sid < 0) {
            throw this.fail(arg, "processMsgArgs Bad or Missing Sid Error");
        }
        if (this.ma.size < 0) {
            throw this.fail(arg, "processMsgArgs Bad or Missing Size Error");
        }
    }
    fail(data, label = "") {
        if (!label) {
            label = `parse error [${this.state}]`;
        }
        else {
            label = `${label} [${this.state}]`;
        }
        return new Error(`${label}: ${encoders_1.TD.decode(data)}`);
    }
    processHeaderMsgArgs(arg) {
        const args = [];
        let start = -1;
        for (let i = 0; i < arg.length; i++) {
            const b = arg[i];
            switch (b) {
                case cc.SPACE:
                case cc.TAB:
                case cc.CR:
                case cc.NL:
                    if (start >= 0) {
                        args.push(arg.subarray(start, i));
                        start = -1;
                    }
                    break;
                default:
                    if (start < 0) {
                        start = i;
                    }
            }
        }
        if (start >= 0) {
            args.push(arg.subarray(start));
        }
        switch (args.length) {
            case 4:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = undefined;
                this.ma.hdr = this.protoParseInt(args[2]);
                this.ma.size = this.protoParseInt(args[3]);
                break;
            case 5:
                this.ma.subject = args[0];
                this.ma.sid = this.protoParseInt(args[1]);
                this.ma.reply = args[2];
                this.ma.hdr = this.protoParseInt(args[3]);
                this.ma.size = this.protoParseInt(args[4]);
                break;
            default:
                throw this.fail(arg, "processHeaderMsgArgs Parse Error");
        }
        if (this.ma.sid < 0) {
            throw this.fail(arg, "processHeaderMsgArgs Bad or Missing Sid Error");
        }
        if (this.ma.hdr < 0 || this.ma.hdr > this.ma.size) {
            throw this.fail(arg, "processHeaderMsgArgs Bad or Missing Header Size Error");
        }
        if (this.ma.size < 0) {
            throw this.fail(arg, "processHeaderMsgArgs Bad or Missing Size Error");
        }
    }
    protoParseInt(a) {
        if (a.length === 0) {
            return -1;
        }
        let n = 0;
        for (let i = 0; i < a.length; i++) {
            if (a[i] < ASCII_0 || a[i] > ASCII_9) {
                return -1;
            }
            n = n * 10 + (a[i] - ASCII_0);
        }
        return n;
    }
}
exports.Parser = Parser;
var State;
(function (State) {
    State[State["OP_START"] = 0] = "OP_START";
    State[State["OP_PLUS"] = 1] = "OP_PLUS";
    State[State["OP_PLUS_O"] = 2] = "OP_PLUS_O";
    State[State["OP_PLUS_OK"] = 3] = "OP_PLUS_OK";
    State[State["OP_MINUS"] = 4] = "OP_MINUS";
    State[State["OP_MINUS_E"] = 5] = "OP_MINUS_E";
    State[State["OP_MINUS_ER"] = 6] = "OP_MINUS_ER";
    State[State["OP_MINUS_ERR"] = 7] = "OP_MINUS_ERR";
    State[State["OP_MINUS_ERR_SPC"] = 8] = "OP_MINUS_ERR_SPC";
    State[State["MINUS_ERR_ARG"] = 9] = "MINUS_ERR_ARG";
    State[State["OP_M"] = 10] = "OP_M";
    State[State["OP_MS"] = 11] = "OP_MS";
    State[State["OP_MSG"] = 12] = "OP_MSG";
    State[State["OP_MSG_SPC"] = 13] = "OP_MSG_SPC";
    State[State["MSG_ARG"] = 14] = "MSG_ARG";
    State[State["MSG_PAYLOAD"] = 15] = "MSG_PAYLOAD";
    State[State["MSG_END"] = 16] = "MSG_END";
    State[State["OP_H"] = 17] = "OP_H";
    State[State["OP_P"] = 18] = "OP_P";
    State[State["OP_PI"] = 19] = "OP_PI";
    State[State["OP_PIN"] = 20] = "OP_PIN";
    State[State["OP_PING"] = 21] = "OP_PING";
    State[State["OP_PO"] = 22] = "OP_PO";
    State[State["OP_PON"] = 23] = "OP_PON";
    State[State["OP_PONG"] = 24] = "OP_PONG";
    State[State["OP_I"] = 25] = "OP_I";
    State[State["OP_IN"] = 26] = "OP_IN";
    State[State["OP_INF"] = 27] = "OP_INF";
    State[State["OP_INFO"] = 28] = "OP_INFO";
    State[State["OP_INFO_SPC"] = 29] = "OP_INFO_SPC";
    State[State["INFO_ARG"] = 30] = "INFO_ARG";
})(State || (exports.State = State = {}));
var cc;
(function (cc) {
    cc[cc["CR"] = "\r".charCodeAt(0)] = "CR";
    cc[cc["E"] = "E".charCodeAt(0)] = "E";
    cc[cc["e"] = "e".charCodeAt(0)] = "e";
    cc[cc["F"] = "F".charCodeAt(0)] = "F";
    cc[cc["f"] = "f".charCodeAt(0)] = "f";
    cc[cc["G"] = "G".charCodeAt(0)] = "G";
    cc[cc["g"] = "g".charCodeAt(0)] = "g";
    cc[cc["H"] = "H".charCodeAt(0)] = "H";
    cc[cc["h"] = "h".charCodeAt(0)] = "h";
    cc[cc["I"] = "I".charCodeAt(0)] = "I";
    cc[cc["i"] = "i".charCodeAt(0)] = "i";
    cc[cc["K"] = "K".charCodeAt(0)] = "K";
    cc[cc["k"] = "k".charCodeAt(0)] = "k";
    cc[cc["M"] = "M".charCodeAt(0)] = "M";
    cc[cc["m"] = "m".charCodeAt(0)] = "m";
    cc[cc["MINUS"] = "-".charCodeAt(0)] = "MINUS";
    cc[cc["N"] = "N".charCodeAt(0)] = "N";
    cc[cc["n"] = "n".charCodeAt(0)] = "n";
    cc[cc["NL"] = "\n".charCodeAt(0)] = "NL";
    cc[cc["O"] = "O".charCodeAt(0)] = "O";
    cc[cc["o"] = "o".charCodeAt(0)] = "o";
    cc[cc["P"] = "P".charCodeAt(0)] = "P";
    cc[cc["p"] = "p".charCodeAt(0)] = "p";
    cc[cc["PLUS"] = "+".charCodeAt(0)] = "PLUS";
    cc[cc["R"] = "R".charCodeAt(0)] = "R";
    cc[cc["r"] = "r".charCodeAt(0)] = "r";
    cc[cc["S"] = "S".charCodeAt(0)] = "S";
    cc[cc["s"] = "s".charCodeAt(0)] = "s";
    cc[cc["SPACE"] = " ".charCodeAt(0)] = "SPACE";
    cc[cc["TAB"] = "\t".charCodeAt(0)] = "TAB";
})(cc || (cc = {}));
//# sourceMappingURL=parser.js.map