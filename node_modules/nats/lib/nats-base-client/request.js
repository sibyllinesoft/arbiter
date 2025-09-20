"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestOne = exports.RequestMany = exports.BaseRequest = void 0;
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
const util_1 = require("./util");
const nuid_1 = require("./nuid");
const core_1 = require("./core");
class BaseRequest {
    constructor(mux, requestSubject, asyncTraces = true) {
        this.mux = mux;
        this.requestSubject = requestSubject;
        this.received = 0;
        this.token = nuid_1.nuid.next();
        if (asyncTraces) {
            this.ctx = new Error();
        }
    }
}
exports.BaseRequest = BaseRequest;
/**
 * Request expects multiple message response
 * the request ends when the timer expires,
 * an error arrives or an expected count of messages
 * arrives, end is signaled by a null message
 */
class RequestMany extends BaseRequest {
    constructor(mux, requestSubject, opts = { maxWait: 1000 }) {
        super(mux, requestSubject);
        this.opts = opts;
        if (typeof this.opts.callback !== "function") {
            throw new Error("callback is required");
        }
        this.callback = this.opts.callback;
        this.max = typeof opts.maxMessages === "number" && opts.maxMessages > 0
            ? opts.maxMessages
            : -1;
        this.done = (0, util_1.deferred)();
        this.done.then(() => {
            this.callback(null, null);
        });
        // @ts-ignore: node is not a number
        this.timer = setTimeout(() => {
            this.cancel();
        }, opts.maxWait);
    }
    cancel(err) {
        if (err) {
            this.callback(err, null);
        }
        clearTimeout(this.timer);
        this.mux.cancel(this);
        this.done.resolve();
    }
    resolver(err, msg) {
        if (err) {
            if (this.ctx) {
                err.stack += `\n\n${this.ctx.stack}`;
            }
            this.cancel(err);
        }
        else {
            this.callback(null, msg);
            if (this.opts.strategy === core_1.RequestStrategy.Count) {
                this.max--;
                if (this.max === 0) {
                    this.cancel();
                }
            }
            if (this.opts.strategy === core_1.RequestStrategy.JitterTimer) {
                clearTimeout(this.timer);
                // @ts-ignore: node is not a number
                this.timer = setTimeout(() => {
                    this.cancel();
                }, this.opts.jitter || 300);
            }
            if (this.opts.strategy === core_1.RequestStrategy.SentinelMsg) {
                if (msg && msg.data.length === 0) {
                    this.cancel();
                }
            }
        }
    }
}
exports.RequestMany = RequestMany;
class RequestOne extends BaseRequest {
    constructor(mux, requestSubject, opts = { timeout: 1000 }, asyncTraces = true) {
        super(mux, requestSubject, asyncTraces);
        // extend(this, opts);
        this.deferred = (0, util_1.deferred)();
        this.timer = (0, util_1.timeout)(opts.timeout, asyncTraces);
    }
    resolver(err, msg) {
        if (this.timer) {
            this.timer.cancel();
        }
        if (err) {
            if (this.ctx) {
                err.stack += `\n\n${this.ctx.stack}`;
            }
            this.deferred.reject(err);
        }
        else {
            this.deferred.resolve(msg);
        }
        this.cancel();
    }
    cancel(err) {
        if (this.timer) {
            this.timer.cancel();
        }
        this.mux.cancel(this);
        this.deferred.reject(err ? err : core_1.NatsError.errorForCode(core_1.ErrorCode.Cancelled));
    }
}
exports.RequestOne = RequestOne;
//# sourceMappingURL=request.js.map