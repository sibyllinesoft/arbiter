"use strict";
/*
 * Copyright 2021-2023 The NATS Authors
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
exports.BaseApiClient = void 0;
exports.defaultJsOptions = defaultJsOptions;
const encoders_1 = require("../nats-base-client/encoders");
const codec_1 = require("../nats-base-client/codec");
const util_1 = require("../nats-base-client/util");
const jsutil_1 = require("./jsutil");
const core_1 = require("../nats-base-client/core");
const defaultPrefix = "$JS.API";
const defaultTimeout = 5000;
function defaultJsOptions(opts) {
    opts = opts || {};
    if (opts.domain) {
        opts.apiPrefix = `$JS.${opts.domain}.API`;
        delete opts.domain;
    }
    return (0, util_1.extend)({ apiPrefix: defaultPrefix, timeout: defaultTimeout }, opts);
}
class BaseApiClient {
    constructor(nc, opts) {
        this.nc = nc;
        this.opts = defaultJsOptions(opts);
        this._parseOpts();
        this.prefix = this.opts.apiPrefix;
        this.timeout = this.opts.timeout;
        this.jc = (0, codec_1.JSONCodec)();
    }
    getOptions() {
        return Object.assign({}, this.opts);
    }
    _parseOpts() {
        let prefix = this.opts.apiPrefix;
        if (!prefix || prefix.length === 0) {
            throw new Error("invalid empty prefix");
        }
        const c = prefix[prefix.length - 1];
        if (c === ".") {
            prefix = prefix.substr(0, prefix.length - 1);
        }
        this.opts.apiPrefix = prefix;
    }
    _request(subj_1) {
        return __awaiter(this, arguments, void 0, function* (subj, data = null, opts) {
            opts = opts || {};
            opts.timeout = this.timeout;
            let a = encoders_1.Empty;
            if (data) {
                a = this.jc.encode(data);
            }
            let { retries } = opts;
            retries = retries || 1;
            retries = retries === -1 ? Number.MAX_SAFE_INTEGER : retries;
            const bo = (0, util_1.backoff)();
            for (let i = 0; i < retries; i++) {
                try {
                    const m = yield this.nc.request(subj, a, opts);
                    return this.parseJsResponse(m);
                }
                catch (err) {
                    const ne = err;
                    if ((ne.code === "503" || ne.code === core_1.ErrorCode.Timeout) &&
                        i + 1 < retries) {
                        yield (0, util_1.delay)(bo.backoff(i));
                    }
                    else {
                        throw err;
                    }
                }
            }
        });
    }
    findStream(subject) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = { subject };
            const r = yield this._request(`${this.prefix}.STREAM.NAMES`, q);
            const names = r;
            if (!names.streams || names.streams.length !== 1) {
                throw new Error("no stream matches subject");
            }
            return names.streams[0];
        });
    }
    getConnection() {
        return this.nc;
    }
    parseJsResponse(m) {
        const v = this.jc.decode(m.data);
        const r = v;
        if (r.error) {
            const err = (0, jsutil_1.checkJsErrorCode)(r.error.code, r.error.description);
            if (err !== null) {
                err.api_error = r.error;
                throw err;
            }
        }
        return v;
    }
}
exports.BaseApiClient = BaseApiClient;
//# sourceMappingURL=jsbaseclient_api.js.map