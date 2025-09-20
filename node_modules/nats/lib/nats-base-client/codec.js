"use strict";
/*
 * Copyright 2020-2022 The NATS Authors
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
exports.StringCodec = StringCodec;
exports.JSONCodec = JSONCodec;
const encoders_1 = require("./encoders");
const core_1 = require("./core");
/**
 * Returns a {@link Codec} for encoding strings to a message payload
 * and decoding message payloads into strings.
 * @constructor
 */
function StringCodec() {
    return {
        encode(d) {
            return encoders_1.TE.encode(d);
        },
        decode(a) {
            return encoders_1.TD.decode(a);
        },
    };
}
/**
 * Returns a {@link Codec}  for encoding JavaScript object to JSON and
 * serialize them to an Uint8Array, and conversely, from an
 * Uint8Array to JSON to a JavaScript Object.
 * @param reviver
 * @constructor
 */
function JSONCodec(reviver) {
    return {
        encode(d) {
            try {
                if (d === undefined) {
                    // @ts-ignore: json will not handle undefined
                    d = null;
                }
                return encoders_1.TE.encode(JSON.stringify(d));
            }
            catch (err) {
                throw core_1.NatsError.errorForCode(core_1.ErrorCode.BadJson, err);
            }
        },
        decode(a) {
            try {
                return JSON.parse(encoders_1.TD.decode(a), reviver);
            }
            catch (err) {
                throw core_1.NatsError.errorForCode(core_1.ErrorCode.BadJson, err);
            }
        },
    };
}
//# sourceMappingURL=codec.js.map