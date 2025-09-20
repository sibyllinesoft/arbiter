"use strict";
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuedIteratorImpl = void 0;
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
const util_1 = require("./util");
const core_1 = require("./core");
class QueuedIteratorImpl {
    constructor() {
        this.inflight = 0;
        this.filtered = 0;
        this.pendingFiltered = 0;
        this.processed = 0;
        this.received = 0;
        this.noIterator = false;
        this.done = false;
        this.signal = (0, util_1.deferred)();
        this.yields = [];
        this.iterClosed = (0, util_1.deferred)();
        this.time = 0;
        this.yielding = false;
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
    push(v) {
        if (this.done) {
            return;
        }
        if (typeof v === "function") {
            this.yields.push(v);
            this.signal.resolve();
            return;
        }
        const { ingest, protocol } = this.ingestionFilterFn
            ? this.ingestionFilterFn(v, this.ctx || this)
            : { ingest: true, protocol: false };
        if (ingest) {
            if (protocol) {
                this.filtered++;
                this.pendingFiltered++;
            }
            this.yields.push(v);
            this.signal.resolve();
        }
    }
    iterate() {
        return __asyncGenerator(this, arguments, function* iterate_1() {
            if (this.noIterator) {
                throw new core_1.NatsError("unsupported iterator", core_1.ErrorCode.ApiError);
            }
            if (this.yielding) {
                throw new core_1.NatsError("already yielding", core_1.ErrorCode.ApiError);
            }
            this.yielding = true;
            try {
                while (true) {
                    if (this.yields.length === 0) {
                        yield __await(this.signal);
                    }
                    if (this.err) {
                        throw this.err;
                    }
                    const yields = this.yields;
                    this.inflight = yields.length;
                    this.yields = [];
                    for (let i = 0; i < yields.length; i++) {
                        if (typeof yields[i] === "function") {
                            const fn = yields[i];
                            try {
                                fn();
                            }
                            catch (err) {
                                // failed on the invocation - fail the iterator
                                // so they know to fix the callback
                                throw err;
                            }
                            // fn could have also set an error
                            if (this.err) {
                                throw this.err;
                            }
                            continue;
                        }
                        // only pass messages that pass the filter
                        const ok = this.protocolFilterFn
                            ? this.protocolFilterFn(yields[i])
                            : true;
                        if (ok) {
                            this.processed++;
                            const start = Date.now();
                            yield yield __await(yields[i]);
                            this.time = Date.now() - start;
                            if (this.dispatchedFn && yields[i]) {
                                this.dispatchedFn(yields[i]);
                            }
                        }
                        else {
                            this.pendingFiltered--;
                        }
                        this.inflight--;
                    }
                    // yielding could have paused and microtask
                    // could have added messages. Prevent allocations
                    // if possible
                    if (this.done) {
                        break;
                    }
                    else if (this.yields.length === 0) {
                        yields.length = 0;
                        this.yields = yields;
                        this.signal = (0, util_1.deferred)();
                    }
                }
            }
            finally {
                // the iterator used break/return
                this.stop();
            }
        });
    }
    stop(err) {
        if (this.done) {
            return;
        }
        this.err = err;
        this.done = true;
        this.signal.resolve();
        this.iterClosed.resolve(err);
    }
    getProcessed() {
        return this.noIterator ? this.received : this.processed;
    }
    getPending() {
        return this.yields.length + this.inflight - this.pendingFiltered;
    }
    getReceived() {
        return this.received - this.filtered;
    }
}
exports.QueuedIteratorImpl = QueuedIteratorImpl;
//# sourceMappingURL=queued_iterator.js.map