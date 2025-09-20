"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MuxSubscription = void 0;
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
const msg_1 = require("./msg");
const core_1 = require("./core");
class MuxSubscription {
    constructor() {
        this.reqs = new Map();
    }
    size() {
        return this.reqs.size;
    }
    init(prefix) {
        this.baseInbox = `${(0, core_1.createInbox)(prefix)}.`;
        return this.baseInbox;
    }
    add(r) {
        if (!isNaN(r.received)) {
            r.received = 0;
        }
        this.reqs.set(r.token, r);
    }
    get(token) {
        return this.reqs.get(token);
    }
    cancel(r) {
        this.reqs.delete(r.token);
    }
    getToken(m) {
        const s = m.subject || "";
        if (s.indexOf(this.baseInbox) === 0) {
            return s.substring(this.baseInbox.length);
        }
        return null;
    }
    all() {
        return Array.from(this.reqs.values());
    }
    handleError(isMuxPermissionError, err) {
        if (err && err.permissionContext) {
            if (isMuxPermissionError) {
                // one or more requests queued but mux cannot process them
                this.all().forEach((r) => {
                    r.resolver(err, {});
                });
                return true;
            }
            const ctx = err.permissionContext;
            if (ctx.operation === "publish") {
                const req = this.all().find((s) => {
                    return s.requestSubject === ctx.subject;
                });
                if (req) {
                    req.resolver(err, {});
                    return true;
                }
            }
        }
        return false;
    }
    dispatcher() {
        return (err, m) => {
            const token = this.getToken(m);
            if (token) {
                const r = this.get(token);
                if (r) {
                    if (err === null && m.headers) {
                        err = (0, msg_1.isRequestError)(m);
                    }
                    r.resolver(err, m);
                }
            }
        };
    }
    close() {
        const err = core_1.NatsError.errorForCode(core_1.ErrorCode.Timeout);
        this.reqs.forEach((req) => {
            req.resolver(err, {});
        });
    }
}
exports.MuxSubscription = MuxSubscription;
//# sourceMappingURL=muxsubscription.js.map