/*
 * Copyright 2016-2021 The NATS Authors
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
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nuid = exports.Nuid = void 0;
const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const base = 36;
const preLen = 12;
const seqLen = 10;
const maxSeq = 3656158440062976; // base^seqLen == 36^10
const minInc = 33;
const maxInc = 333;
const totalLen = preLen + seqLen;
function _getRandomValues(a) {
    for (let i = 0; i < a.length; i++) {
        a[i] = Math.floor(Math.random() * 255);
    }
}
function fillRandom(a) {
    var _a;
    if ((_a = globalThis === null || globalThis === void 0 ? void 0 : globalThis.crypto) === null || _a === void 0 ? void 0 : _a.getRandomValues) {
        globalThis.crypto.getRandomValues(a);
    }
    else {
        _getRandomValues(a);
    }
}
/**
 * Create and initialize a nuid.
 *
 * @api private
 */
class Nuid {
    constructor() {
        this.buf = new Uint8Array(totalLen);
        this.inited = false;
    }
    /**
     * Initializes a nuid with a crypto random prefix,
     * and pseudo-random sequence and increment.
     *
     * @api private
     */
    init() {
        this.inited = true;
        this.setPre();
        this.initSeqAndInc();
        this.fillSeq();
    }
    /**
     * Initializes the pseudo randmon sequence number and the increment range.
     *
     * @api private
     */
    initSeqAndInc() {
        this.seq = Math.floor(Math.random() * maxSeq);
        this.inc = Math.floor(Math.random() * (maxInc - minInc) + minInc);
    }
    /**
     * Sets the prefix from crypto random bytes. Converts to base36.
     *
     * @api private
     */
    setPre() {
        const cbuf = new Uint8Array(preLen);
        fillRandom(cbuf);
        for (let i = 0; i < preLen; i++) {
            const di = cbuf[i] % base;
            this.buf[i] = digits.charCodeAt(di);
        }
    }
    /**
     * Fills the sequence part of the nuid as base36 from this.seq.
     *
     * @api private
     */
    fillSeq() {
        let n = this.seq;
        for (let i = totalLen - 1; i >= preLen; i--) {
            this.buf[i] = digits.charCodeAt(n % base);
            n = Math.floor(n / base);
        }
    }
    /**
     * Returns the next nuid.
     *
     * @api private
     */
    next() {
        if (!this.inited) {
            this.init();
        }
        this.seq += this.inc;
        if (this.seq > maxSeq) {
            this.setPre();
            this.initSeqAndInc();
        }
        this.fillSeq();
        // @ts-ignore - Uint8Arrays can be an argument
        return String.fromCharCode.apply(String, this.buf);
    }
    reset() {
        this.init();
    }
}
exports.Nuid = Nuid;
exports.nuid = new Nuid();
//# sourceMappingURL=nuid.js.map