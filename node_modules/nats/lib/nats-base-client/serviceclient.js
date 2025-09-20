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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceClientImpl = void 0;
/*
 * Copyright 2022-2023 The NATS Authors
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
const codec_1 = require("./codec");
const queued_iterator_1 = require("./queued_iterator");
const core_1 = require("./core");
const service_1 = require("./service");
const core_2 = require("./core");
class ServiceClientImpl {
    constructor(nc, opts = {
        strategy: core_2.RequestStrategy.JitterTimer,
        maxWait: 2000,
    }, prefix) {
        this.nc = nc;
        this.prefix = prefix;
        this.opts = opts;
    }
    ping(name = "", id = "") {
        return this.q(core_1.ServiceVerb.PING, name, id);
    }
    stats(name = "", id = "") {
        return this.q(core_1.ServiceVerb.STATS, name, id);
    }
    info(name = "", id = "") {
        return this.q(core_1.ServiceVerb.INFO, name, id);
    }
    q(v_1) {
        return __awaiter(this, arguments, void 0, function* (v, name = "", id = "") {
            const iter = new queued_iterator_1.QueuedIteratorImpl();
            const jc = (0, codec_1.JSONCodec)();
            const subj = service_1.ServiceImpl.controlSubject(v, name, id, this.prefix);
            const responses = yield this.nc.requestMany(subj, encoders_1.Empty, this.opts);
            (() => __awaiter(this, void 0, void 0, function* () {
                var _a, e_1, _b, _c;
                try {
                    for (var _d = true, responses_1 = __asyncValues(responses), responses_1_1; responses_1_1 = yield responses_1.next(), _a = responses_1_1.done, !_a; _d = true) {
                        _c = responses_1_1.value;
                        _d = false;
                        const m = _c;
                        try {
                            const s = jc.decode(m.data);
                            iter.push(s);
                        }
                        catch (err) {
                            // @ts-ignore: pushing fn
                            iter.push(() => {
                                iter.stop(err);
                            });
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = responses_1.return)) yield _b.call(responses_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                //@ts-ignore: push a fn
                iter.push(() => {
                    iter.stop();
                });
            }))().catch((err) => {
                iter.stop(err);
            });
            return iter;
        });
    }
}
exports.ServiceClientImpl = ServiceClientImpl;
//# sourceMappingURL=serviceclient.js.map