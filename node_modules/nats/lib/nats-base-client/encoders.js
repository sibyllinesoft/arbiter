"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TD = exports.TE = exports.Empty = void 0;
exports.encode = encode;
exports.decode = decode;
/*
 * Copyright 2020 The NATS Authors
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
exports.Empty = new Uint8Array(0);
exports.TE = new TextEncoder();
exports.TD = new TextDecoder();
function concat(...bufs) {
    let max = 0;
    for (let i = 0; i < bufs.length; i++) {
        max += bufs[i].length;
    }
    const out = new Uint8Array(max);
    let index = 0;
    for (let i = 0; i < bufs.length; i++) {
        out.set(bufs[i], index);
        index += bufs[i].length;
    }
    return out;
}
function encode(...a) {
    const bufs = [];
    for (let i = 0; i < a.length; i++) {
        bufs.push(exports.TE.encode(a[i]));
    }
    if (bufs.length === 0) {
        return exports.Empty;
    }
    if (bufs.length === 1) {
        return bufs[0];
    }
    return concat(...bufs);
}
function decode(a) {
    if (!a || a.length === 0) {
        return "";
    }
    return exports.TD.decode(a);
}
//# sourceMappingURL=encoders.js.map