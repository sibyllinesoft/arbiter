"use strict";
/*
 * Copyright 2024 The NATS Authors
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
exports.CurveKP = exports.curveNonceLen = exports.curveKeyLen = void 0;
const nkeys_1 = require("./nkeys");
const helper_1 = require("./helper");
const codec_1 = require("./codec");
const mod_1 = require("./mod");
const base32_1 = require("./base32");
const crc16_1 = require("./crc16");
exports.curveKeyLen = 32;
const curveDecodeLen = 35;
exports.curveNonceLen = 24;
// "xkv1" in bytes
const XKeyVersionV1 = [120, 107, 118, 49];
class CurveKP {
    constructor(seed) {
        this.seed = seed;
    }
    clear() {
        if (!this.seed) {
            return;
        }
        this.seed.fill(0);
        this.seed = undefined;
    }
    getPrivateKey() {
        if (!this.seed) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.ClearedPair);
        }
        return codec_1.Codec.encode(mod_1.Prefix.Private, this.seed);
    }
    getPublicKey() {
        if (!this.seed) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.ClearedPair);
        }
        const pub = (0, helper_1.getEd25519Helper)().scalarBaseMultiply(this.seed);
        const buf = codec_1.Codec.encode(mod_1.Prefix.Curve, pub);
        return new TextDecoder().decode(buf);
    }
    getSeed() {
        if (!this.seed) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.ClearedPair);
        }
        return codec_1.Codec.encodeSeed(mod_1.Prefix.Curve, this.seed);
    }
    sign() {
        throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidCurveOperation);
    }
    verify() {
        throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidCurveOperation);
    }
    decodePubCurveKey(src) {
        try {
            const raw = base32_1.base32.decode(new TextEncoder().encode(src));
            if (raw.byteLength !== curveDecodeLen) {
                throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidCurveKey);
            }
            if (raw[0] !== mod_1.Prefix.Curve) {
                throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidPublicKey);
            }
            const checkOffset = raw.byteLength - 2;
            const dv = new DataView(raw.buffer);
            const checksum = dv.getUint16(checkOffset, true);
            const payload = raw.slice(0, checkOffset);
            if (!crc16_1.crc16.validate(payload, checksum)) {
                throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidChecksum);
            }
            // remove the prefix byte
            return payload.slice(1);
        }
        catch (ex) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidRecipient, ex);
        }
    }
    seal(message, recipient, nonce) {
        if (!this.seed) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.ClearedPair);
        }
        if (!nonce) {
            nonce = (0, helper_1.getEd25519Helper)().randomBytes(exports.curveNonceLen);
        }
        let pub = this.decodePubCurveKey(recipient);
        // prefix a header to the nonce
        const out = new Uint8Array(XKeyVersionV1.length + exports.curveNonceLen);
        out.set(XKeyVersionV1, 0);
        out.set(nonce, XKeyVersionV1.length);
        // this is only the encoded payload
        const encrypted = (0, helper_1.getEd25519Helper)().seal(message, nonce, pub, this.seed);
        // the full message is the header+nonce+encrypted
        const fullMessage = new Uint8Array(out.length + encrypted.length);
        fullMessage.set(out);
        fullMessage.set(encrypted, out.length);
        return fullMessage;
    }
    open(message, sender) {
        if (!this.seed) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.ClearedPair);
        }
        if (message.length <= exports.curveNonceLen + XKeyVersionV1.length) {
            throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidEncrypted);
        }
        for (let i = 0; i < XKeyVersionV1.length; i++) {
            if (message[i] !== XKeyVersionV1[i]) {
                throw new nkeys_1.NKeysError(nkeys_1.NKeysErrorCode.InvalidEncrypted);
            }
        }
        const pub = this.decodePubCurveKey(sender);
        // strip off the header
        message = message.slice(XKeyVersionV1.length);
        // extract the nonce
        const nonce = message.slice(0, exports.curveNonceLen);
        // stripe the nonce
        message = message.slice(exports.curveNonceLen);
        return (0, helper_1.getEd25519Helper)().open(message, nonce, pub, this.seed);
    }
}
exports.CurveKP = CurveKP;
