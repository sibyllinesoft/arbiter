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
exports.ListerImpl = void 0;
class ListerImpl {
    constructor(subject, filter, jsm, payload) {
        if (!subject) {
            throw new Error("subject is required");
        }
        this.subject = subject;
        this.jsm = jsm;
        this.offset = 0;
        this.pageInfo = {};
        this.filter = filter;
        this.payload = payload || {};
    }
    next() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.err) {
                return [];
            }
            if (this.pageInfo && this.offset >= this.pageInfo.total) {
                return [];
            }
            const offset = { offset: this.offset };
            if (this.payload) {
                Object.assign(offset, this.payload);
            }
            try {
                const r = yield this.jsm._request(this.subject, offset, { timeout: this.jsm.timeout });
                this.pageInfo = r;
                // offsets are reported in total, so need to count
                // all the entries returned
                const count = this.countResponse(r);
                if (count === 0) {
                    // we are done if we get a null set of infos
                    return [];
                }
                this.offset += count;
                const a = this.filter(r);
                return a;
            }
            catch (err) {
                this.err = err;
                throw err;
            }
        });
    }
    countResponse(r) {
        var _a, _b, _c;
        switch (r === null || r === void 0 ? void 0 : r.type) {
            case "io.nats.jetstream.api.v1.stream_names_response":
            case "io.nats.jetstream.api.v1.stream_list_response":
                return ((_a = r.streams) === null || _a === void 0 ? void 0 : _a.length) || 0;
            case "io.nats.jetstream.api.v1.consumer_list_response":
                return ((_b = r.consumers) === null || _b === void 0 ? void 0 : _b.length) || 0;
            default:
                console.error(`jslister.ts: unknown API response for paged output: ${r === null || r === void 0 ? void 0 : r.type}`);
                // has to be a stream...
                return ((_c = r.streams) === null || _c === void 0 ? void 0 : _c.length) || 0;
        }
        return 0;
    }
    [Symbol.asyncIterator]() {
        return __asyncGenerator(this, arguments, function* _a() {
            let page = yield __await(this.next());
            while (page.length > 0) {
                for (const item of page) {
                    yield yield __await(item);
                }
                page = yield __await(this.next());
            }
        });
    }
}
exports.ListerImpl = ListerImpl;
//# sourceMappingURL=jslister.js.map