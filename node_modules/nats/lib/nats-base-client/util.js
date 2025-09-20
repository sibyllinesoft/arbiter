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
exports.SimpleMutex = exports.Perf = void 0;
exports.extend = extend;
exports.render = render;
exports.timeout = timeout;
exports.delay = delay;
exports.deadline = deadline;
exports.deferred = deferred;
exports.debugDeferred = debugDeferred;
exports.shuffle = shuffle;
exports.collect = collect;
exports.jitter = jitter;
exports.backoffWithMax = backoffWithMax;
exports.backoff = backoff;
exports.nanos = nanos;
exports.millis = millis;
/*
 * Copyright 2018-2023 The NATS Authors
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
// deno-lint-ignore-file no-explicit-any
const encoders_1 = require("./encoders");
const core_1 = require("./core");
function extend(a, ...b) {
    for (let i = 0; i < b.length; i++) {
        const o = b[i];
        Object.keys(o).forEach(function (k) {
            a[k] = o[k];
        });
    }
    return a;
}
function render(frame) {
    const cr = "␍";
    const lf = "␊";
    return encoders_1.TD.decode(frame)
        .replace(/\n/g, lf)
        .replace(/\r/g, cr);
}
function timeout(ms, asyncTraces = true) {
    // by generating the stack here to help identify what timed out
    const err = asyncTraces ? core_1.NatsError.errorForCode(core_1.ErrorCode.Timeout) : null;
    let methods;
    let timer;
    const p = new Promise((_resolve, reject) => {
        const cancel = () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
        methods = { cancel };
        // @ts-ignore: node is not a number
        timer = setTimeout(() => {
            if (err === null) {
                reject(core_1.NatsError.errorForCode(core_1.ErrorCode.Timeout));
            }
            else {
                reject(err);
            }
        }, ms);
    });
    // noinspection JSUnusedAssignment
    return Object.assign(p, methods);
}
function delay(ms = 0) {
    let methods;
    const p = new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve();
        }, ms);
        const cancel = () => {
            if (timer) {
                clearTimeout(timer);
            }
        };
        methods = { cancel };
    });
    return Object.assign(p, methods);
}
function deadline(p, millis = 1000) {
    const err = new Error(`deadline exceeded`);
    const d = deferred();
    const timer = setTimeout(() => d.reject(err), millis);
    return Promise.race([p, d]).finally(() => clearTimeout(timer));
}
/**
 * Returns a Promise that has a resolve/reject methods that can
 * be used to resolve and defer the Deferred.
 */
function deferred() {
    let methods = {};
    const p = new Promise((resolve, reject) => {
        methods = { resolve, reject };
    });
    return Object.assign(p, methods);
}
function debugDeferred() {
    let methods = {};
    const p = new Promise((resolve, reject) => {
        methods = {
            resolve: (v) => {
                console.trace("resolve", v);
                resolve(v);
            },
            reject: (err) => {
                console.trace("reject");
                reject(err);
            },
        };
    });
    return Object.assign(p, methods);
}
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function collect(iter) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, iter_1, iter_1_1;
        var _b, e_1, _c, _d;
        const buf = [];
        try {
            for (_a = true, iter_1 = __asyncValues(iter); iter_1_1 = yield iter_1.next(), _b = iter_1_1.done, !_b; _a = true) {
                _d = iter_1_1.value;
                _a = false;
                const v = _d;
                buf.push(v);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_a && !_b && (_c = iter_1.return)) yield _c.call(iter_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return buf;
    });
}
class Perf {
    constructor() {
        this.timers = new Map();
        this.measures = new Map();
    }
    mark(key) {
        this.timers.set(key, performance.now());
    }
    measure(key, startKey, endKey) {
        const s = this.timers.get(startKey);
        if (s === undefined) {
            throw new Error(`${startKey} is not defined`);
        }
        const e = this.timers.get(endKey);
        if (e === undefined) {
            throw new Error(`${endKey} is not defined`);
        }
        this.measures.set(key, e - s);
    }
    getEntries() {
        const values = [];
        this.measures.forEach((v, k) => {
            values.push({ name: k, duration: v });
        });
        return values;
    }
}
exports.Perf = Perf;
class SimpleMutex {
    /**
     * @param max number of concurrent operations
     */
    constructor(max = 1) {
        this.max = max;
        this.current = 0;
        this.waiting = [];
    }
    /**
     * Returns a promise that resolves when the mutex is acquired
     */
    lock() {
        // increment the count
        this.current++;
        // if we have runners, resolve it
        if (this.current <= this.max) {
            return Promise.resolve();
        }
        // otherwise defer it
        const d = deferred();
        this.waiting.push(d);
        return d;
    }
    /**
     * Release an acquired mutex - must be called
     */
    unlock() {
        // decrement the count
        this.current--;
        // if we have deferred, resolve one
        const d = this.waiting.pop();
        d === null || d === void 0 ? void 0 : d.resolve();
    }
}
exports.SimpleMutex = SimpleMutex;
/**
 * Returns a new number between  .5*n and 1.5*n.
 * If the n is 0, returns 0.
 * @param n
 */
function jitter(n) {
    if (n === 0) {
        return 0;
    }
    return Math.floor(n / 2 + Math.random() * n);
}
function backoffWithMax(max = 30000) {
    const a = [max];
    while (true) {
        const n = Math.floor(max / 2);
        if (n < 100) {
            // always try right away
            a.unshift(0);
            break;
        }
        a.unshift(n);
        max = n;
    }
    return backoff(a);
}
/**
 * Returns a Backoff with the specified interval policy set.
 * @param policy
 */
function backoff(policy = [0, 250, 250, 500, 500, 3000, 5000]) {
    if (!Array.isArray(policy)) {
        policy = [0, 250, 250, 500, 500, 3000, 5000];
    }
    const max = policy.length - 1;
    return {
        backoff(attempt) {
            return jitter(attempt > max ? policy[max] : policy[attempt]);
        },
    };
}
/**
 * Converts the specified millis into Nanos
 * @param millis
 */
function nanos(millis) {
    return millis * 1000000;
}
/**
 * Convert the specified Nanos into millis
 * @param ns
 */
function millis(ns) {
    return Math.floor(ns / 1000000);
}
//# sourceMappingURL=util.js.map