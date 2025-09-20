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
exports.ConsumerAPIImpl = void 0;
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
const jsbaseclient_api_1 = require("./jsbaseclient_api");
const jslister_1 = require("./jslister");
const jsutil_1 = require("./jsutil");
const semver_1 = require("../nats-base-client/semver");
const jsapi_types_1 = require("./jsapi_types");
class ConsumerAPIImpl extends jsbaseclient_api_1.BaseApiClient {
    constructor(nc, opts) {
        super(nc, opts);
    }
    add(stream_1, cfg_1) {
        return __awaiter(this, arguments, void 0, function* (stream, cfg, action = jsapi_types_1.ConsumerApiAction.Create) {
            var _a, _b, _c;
            (0, jsutil_1.validateStreamName)(stream);
            if (cfg.deliver_group && cfg.flow_control) {
                throw new Error("jetstream flow control is not supported with queue groups");
            }
            if (cfg.deliver_group && cfg.idle_heartbeat) {
                throw new Error("jetstream idle heartbeat is not supported with queue groups");
            }
            const cr = {};
            cr.config = cfg;
            cr.stream_name = stream;
            cr.action = action;
            if (cr.config.durable_name) {
                (0, jsutil_1.validateDurableName)(cr.config.durable_name);
            }
            const nci = this.nc;
            let { min, ok: newAPI } = nci.features.get(semver_1.Feature.JS_NEW_CONSUMER_CREATE_API);
            const name = cfg.name === "" ? undefined : cfg.name;
            if (name && !newAPI) {
                throw new Error(`consumer 'name' requires server ${min}`);
            }
            if (name) {
                try {
                    (0, jsutil_1.minValidation)("name", name);
                }
                catch (err) {
                    // if we have a cannot contain the message, massage a bit
                    const m = err.message;
                    const idx = m.indexOf("cannot contain");
                    if (idx !== -1) {
                        throw new Error(`consumer 'name' ${m.substring(idx)}`);
                    }
                    throw err;
                }
            }
            let subj;
            let consumerName = "";
            // new api doesn't support multiple filter subjects
            // this delayed until here because the consumer in an update could have
            // been created with the new API, and have a `name`
            if (Array.isArray(cfg.filter_subjects)) {
                const { min, ok } = nci.features.get(semver_1.Feature.JS_MULTIPLE_CONSUMER_FILTER);
                if (!ok) {
                    throw new Error(`consumer 'filter_subjects' requires server ${min}`);
                }
                newAPI = false;
            }
            if (cfg.metadata) {
                const { min, ok } = nci.features.get(semver_1.Feature.JS_STREAM_CONSUMER_METADATA);
                if (!ok) {
                    throw new Error(`consumer 'metadata' requires server ${min}`);
                }
            }
            if (newAPI) {
                consumerName = (_b = (_a = cfg.name) !== null && _a !== void 0 ? _a : cfg.durable_name) !== null && _b !== void 0 ? _b : "";
            }
            if (consumerName !== "") {
                let fs = (_c = cfg.filter_subject) !== null && _c !== void 0 ? _c : undefined;
                if (fs === ">") {
                    fs = undefined;
                }
                subj = fs !== undefined
                    ? `${this.prefix}.CONSUMER.CREATE.${stream}.${consumerName}.${fs}`
                    : `${this.prefix}.CONSUMER.CREATE.${stream}.${consumerName}`;
            }
            else {
                subj = cfg.durable_name
                    ? `${this.prefix}.CONSUMER.DURABLE.CREATE.${stream}.${cfg.durable_name}`
                    : `${this.prefix}.CONSUMER.CREATE.${stream}`;
            }
            const r = yield this._request(subj, cr);
            return r;
        });
    }
    update(stream, durable, cfg) {
        return __awaiter(this, void 0, void 0, function* () {
            const ci = yield this.info(stream, durable);
            const changable = cfg;
            return this.add(stream, Object.assign(ci.config, changable), jsapi_types_1.ConsumerApiAction.Update);
        });
    }
    info(stream, name) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(stream);
            (0, jsutil_1.validateDurableName)(name);
            const r = yield this._request(`${this.prefix}.CONSUMER.INFO.${stream}.${name}`);
            return r;
        });
    }
    delete(stream, name) {
        return __awaiter(this, void 0, void 0, function* () {
            (0, jsutil_1.validateStreamName)(stream);
            (0, jsutil_1.validateDurableName)(name);
            const r = yield this._request(`${this.prefix}.CONSUMER.DELETE.${stream}.${name}`);
            const cr = r;
            return cr.success;
        });
    }
    list(stream) {
        (0, jsutil_1.validateStreamName)(stream);
        const filter = (v) => {
            const clr = v;
            return clr.consumers;
        };
        const subj = `${this.prefix}.CONSUMER.LIST.${stream}`;
        return new jslister_1.ListerImpl(subj, filter, this);
    }
    pause(stream, name, until) {
        const subj = `${this.prefix}.CONSUMER.PAUSE.${stream}.${name}`;
        const opts = {
            pause_until: until.toISOString(),
        };
        return this._request(subj, opts);
    }
    resume(stream, name) {
        return this.pause(stream, name, new Date(0));
    }
}
exports.ConsumerAPIImpl = ConsumerAPIImpl;
//# sourceMappingURL=jsmconsumer_api.js.map