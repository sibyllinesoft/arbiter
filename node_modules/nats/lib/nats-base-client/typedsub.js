"use strict";
/*
 * Copyright 2021 The NATS Authors
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
exports.TypedSubscription = void 0;
exports.checkFn = checkFn;
const util_1 = require("./util");
const queued_iterator_1 = require("./queued_iterator");
const core_1 = require("./core");
function checkFn(fn, name, required = false) {
    if (required === true && !fn) {
        throw core_1.NatsError.errorForCode(core_1.ErrorCode.ApiError, new Error(`${name} is not a function`));
    }
    if (fn && typeof fn !== "function") {
        throw core_1.NatsError.errorForCode(core_1.ErrorCode.ApiError, new Error(`${name} is not a function`));
    }
}
/**
 * TypedSubscription wraps a subscription to provide payload specific
 * subscription semantics. That is messages are a transport
 * for user data, and the data is presented as application specific
 * data to the client.
 */
class TypedSubscription extends queued_iterator_1.QueuedIteratorImpl {
    constructor(nc, subject, opts) {
        super();
        checkFn(opts.adapter, "adapter", true);
        this.adapter = opts.adapter;
        if (opts.callback) {
            checkFn(opts.callback, "callback");
        }
        this.noIterator = typeof opts.callback === "function";
        if (opts.ingestionFilterFn) {
            checkFn(opts.ingestionFilterFn, "ingestionFilterFn");
            this.ingestionFilterFn = opts.ingestionFilterFn;
        }
        if (opts.protocolFilterFn) {
            checkFn(opts.protocolFilterFn, "protocolFilterFn");
            this.protocolFilterFn = opts.protocolFilterFn;
        }
        if (opts.dispatchedFn) {
            checkFn(opts.dispatchedFn, "dispatchedFn");
            this.dispatchedFn = opts.dispatchedFn;
        }
        if (opts.cleanupFn) {
            checkFn(opts.cleanupFn, "cleanupFn");
        }
        let callback = (err, msg) => {
            this.callback(err, msg);
        };
        if (opts.callback) {
            const uh = opts.callback;
            callback = (err, msg) => {
                const [jer, tm] = this.adapter(err, msg);
                if (jer) {
                    uh(jer, null);
                    return;
                }
                const { ingest } = this.ingestionFilterFn
                    ? this.ingestionFilterFn(tm, this)
                    : { ingest: true };
                if (ingest) {
                    const ok = this.protocolFilterFn ? this.protocolFilterFn(tm) : true;
                    if (ok) {
                        uh(jer, tm);
                        if (this.dispatchedFn && tm) {
                            this.dispatchedFn(tm);
                        }
                    }
                }
            };
        }
        const { max, queue, timeout } = opts;
        const sopts = { queue, timeout, callback };
        if (max && max > 0) {
            sopts.max = max;
        }
        this.sub = nc.subscribe(subject, sopts);
        if (opts.cleanupFn) {
            this.sub.cleanupFn = opts.cleanupFn;
        }
        if (!this.noIterator) {
            this.iterClosed.then(() => {
                this.unsubscribe();
            });
        }
        this.subIterDone = (0, util_1.deferred)();
        Promise.all([this.sub.closed, this.iterClosed])
            .then(() => {
            this.subIterDone.resolve();
        })
            .catch(() => {
            this.subIterDone.resolve();
        });
        ((s) => __awaiter(this, void 0, void 0, function* () {
            yield s.closed;
            this.stop();
        }))(this.sub).then().catch();
    }
    unsubscribe(max) {
        this.sub.unsubscribe(max);
    }
    drain() {
        return this.sub.drain();
    }
    isDraining() {
        return this.sub.isDraining();
    }
    isClosed() {
        return this.sub.isClosed();
    }
    callback(e, msg) {
        this.sub.cancelTimeout();
        const [err, tm] = this.adapter(e, msg);
        if (err) {
            this.stop(err);
        }
        if (tm) {
            this.push(tm);
        }
    }
    getSubject() {
        return this.sub.getSubject();
    }
    getReceived() {
        return this.sub.getReceived();
    }
    getProcessed() {
        return this.sub.getProcessed();
    }
    getPending() {
        return this.sub.getPending();
    }
    getID() {
        return this.sub.getID();
    }
    getMax() {
        return this.sub.getMax();
    }
    get closed() {
        return this.sub.closed;
    }
}
exports.TypedSubscription = TypedSubscription;
//# sourceMappingURL=typedsub.js.map