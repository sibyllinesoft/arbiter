"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MsgHdrsImpl = void 0;
exports.canonicalMIMEHeaderKey = canonicalMIMEHeaderKey;
exports.headers = headers;
// Heavily inspired by Golang's https://golang.org/src/net/http/header.go
const encoders_1 = require("./encoders");
const core_1 = require("./core");
// https://www.ietf.org/rfc/rfc822.txt
// 3.1.2.  STRUCTURE OF HEADER FIELDS
//
// Once a field has been unfolded, it may be viewed as being com-
// posed of a field-name followed by a colon (":"), followed by a
// field-body, and  terminated  by  a  carriage-return/line-feed.
// The  field-name must be composed of printable ASCII characters
// (i.e., characters that  have  values  between  33.  and  126.,
// decimal, except colon).  The field-body may be composed of any
// ASCII characters, except CR or LF.  (While CR and/or LF may be
// present  in the actual text, they are removed by the action of
// unfolding the field.)
function canonicalMIMEHeaderKey(k) {
    const a = 97;
    const A = 65;
    const Z = 90;
    const z = 122;
    const dash = 45;
    const colon = 58;
    const start = 33;
    const end = 126;
    const toLower = a - A;
    let upper = true;
    const buf = new Array(k.length);
    for (let i = 0; i < k.length; i++) {
        let c = k.charCodeAt(i);
        if (c === colon || c < start || c > end) {
            throw new core_1.NatsError(`'${k[i]}' is not a valid character for a header key`, core_1.ErrorCode.BadHeader);
        }
        if (upper && a <= c && c <= z) {
            c -= toLower;
        }
        else if (!upper && A <= c && c <= Z) {
            c += toLower;
        }
        buf[i] = c;
        upper = c == dash;
    }
    return String.fromCharCode(...buf);
}
function headers(code = 0, description = "") {
    if ((code === 0 && description !== "") || (code > 0 && description === "")) {
        throw new Error("setting status requires both code and description");
    }
    return new MsgHdrsImpl(code, description);
}
const HEADER = "NATS/1.0";
class MsgHdrsImpl {
    constructor(code = 0, description = "") {
        this._code = code;
        this._description = description;
        this.headers = new Map();
    }
    [Symbol.iterator]() {
        return this.headers.entries();
    }
    size() {
        return this.headers.size;
    }
    equals(mh) {
        if (mh && this.headers.size === mh.headers.size &&
            this._code === mh._code) {
            for (const [k, v] of this.headers) {
                const a = mh.values(k);
                if (v.length !== a.length) {
                    return false;
                }
                const vv = [...v].sort();
                const aa = [...a].sort();
                for (let i = 0; i < vv.length; i++) {
                    if (vv[i] !== aa[i]) {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    }
    static decode(a) {
        const mh = new MsgHdrsImpl();
        const s = encoders_1.TD.decode(a);
        const lines = s.split("\r\n");
        const h = lines[0];
        if (h !== HEADER) {
            // malformed headers could add extra space without adding a code or description
            let str = h.replace(HEADER, "").trim();
            if (str.length > 0) {
                mh._code = parseInt(str, 10);
                if (isNaN(mh._code)) {
                    mh._code = 0;
                }
                const scode = mh._code.toString();
                str = str.replace(scode, "");
                mh._description = str.trim();
            }
        }
        if (lines.length >= 1) {
            lines.slice(1).map((s) => {
                if (s) {
                    const idx = s.indexOf(":");
                    if (idx > -1) {
                        const k = s.slice(0, idx);
                        const v = s.slice(idx + 1).trim();
                        mh.append(k, v);
                    }
                }
            });
        }
        return mh;
    }
    toString() {
        if (this.headers.size === 0 && this._code === 0) {
            return "";
        }
        let s = HEADER;
        if (this._code > 0 && this._description !== "") {
            s += ` ${this._code} ${this._description}`;
        }
        for (const [k, v] of this.headers) {
            for (let i = 0; i < v.length; i++) {
                s = `${s}\r\n${k}: ${v[i]}`;
            }
        }
        return `${s}\r\n\r\n`;
    }
    encode() {
        return encoders_1.TE.encode(this.toString());
    }
    static validHeaderValue(k) {
        const inv = /[\r\n]/;
        if (inv.test(k)) {
            throw new core_1.NatsError("invalid header value - \\r and \\n are not allowed.", core_1.ErrorCode.BadHeader);
        }
        return k.trim();
    }
    keys() {
        const keys = [];
        for (const sk of this.headers.keys()) {
            keys.push(sk);
        }
        return keys;
    }
    findKeys(k, match = core_1.Match.Exact) {
        const keys = this.keys();
        switch (match) {
            case core_1.Match.Exact:
                return keys.filter((v) => {
                    return v === k;
                });
            case core_1.Match.CanonicalMIME:
                k = canonicalMIMEHeaderKey(k);
                return keys.filter((v) => {
                    return v === k;
                });
            default: {
                const lci = k.toLowerCase();
                return keys.filter((v) => {
                    return lci === v.toLowerCase();
                });
            }
        }
    }
    get(k, match = core_1.Match.Exact) {
        const keys = this.findKeys(k, match);
        if (keys.length) {
            const v = this.headers.get(keys[0]);
            if (v) {
                return Array.isArray(v) ? v[0] : v;
            }
        }
        return "";
    }
    last(k, match = core_1.Match.Exact) {
        const keys = this.findKeys(k, match);
        if (keys.length) {
            const v = this.headers.get(keys[0]);
            if (v) {
                return Array.isArray(v) ? v[v.length - 1] : v;
            }
        }
        return "";
    }
    has(k, match = core_1.Match.Exact) {
        return this.findKeys(k, match).length > 0;
    }
    set(k, v, match = core_1.Match.Exact) {
        this.delete(k, match);
        this.append(k, v, match);
    }
    append(k, v, match = core_1.Match.Exact) {
        // validate the key
        const ck = canonicalMIMEHeaderKey(k);
        if (match === core_1.Match.CanonicalMIME) {
            k = ck;
        }
        // if we get non-sensical ignores/etc, we should try
        // to do the right thing and use the first key that matches
        const keys = this.findKeys(k, match);
        k = keys.length > 0 ? keys[0] : k;
        const value = MsgHdrsImpl.validHeaderValue(v);
        let a = this.headers.get(k);
        if (!a) {
            a = [];
            this.headers.set(k, a);
        }
        a.push(value);
    }
    values(k, match = core_1.Match.Exact) {
        const buf = [];
        const keys = this.findKeys(k, match);
        keys.forEach((v) => {
            const values = this.headers.get(v);
            if (values) {
                buf.push(...values);
            }
        });
        return buf;
    }
    delete(k, match = core_1.Match.Exact) {
        const keys = this.findKeys(k, match);
        keys.forEach((v) => {
            this.headers.delete(v);
        });
    }
    get hasError() {
        return this._code >= 300;
    }
    get status() {
        return `${this._code} ${this._description}`.trim();
    }
    toRecord() {
        const data = {};
        this.keys().forEach((v) => {
            data[v] = this.values(v);
        });
        return data;
    }
    get code() {
        return this._code;
    }
    get description() {
        return this._description;
    }
    static fromRecord(r) {
        const h = new MsgHdrsImpl();
        for (const k in r) {
            h.headers.set(k, r[k]);
        }
        return h;
    }
}
exports.MsgHdrsImpl = MsgHdrsImpl;
//# sourceMappingURL=headers.js.map