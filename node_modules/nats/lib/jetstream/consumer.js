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
exports.OrderedPullConsumerImpl = exports.PullConsumerImpl = exports.OrderedConsumerMessages = exports.PullConsumerMessagesImpl = exports.ConsumerDebugEvents = exports.ConsumerEvents = void 0;
/*
 * Copyright 2022-2024 The NATS Authors
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
const util_1 = require("../nats-base-client/util");
const nuid_1 = require("../nats-base-client/nuid");
const jsutil_1 = require("./jsutil");
const queued_iterator_1 = require("../nats-base-client/queued_iterator");
const core_1 = require("../nats-base-client/core");
const idleheartbeat_monitor_1 = require("../nats-base-client/idleheartbeat_monitor");
const jsmsg_1 = require("./jsmsg");
const jsapi_types_1 = require("./jsapi_types");
const types_1 = require("./types");
var PullConsumerType;
(function (PullConsumerType) {
    PullConsumerType[PullConsumerType["Unset"] = -1] = "Unset";
    PullConsumerType[PullConsumerType["Consume"] = 0] = "Consume";
    PullConsumerType[PullConsumerType["Fetch"] = 1] = "Fetch";
})(PullConsumerType || (PullConsumerType = {}));
/**
 * ConsumerEvents are informational notifications emitted by ConsumerMessages
 * that may be of interest to a client.
 */
var ConsumerEvents;
(function (ConsumerEvents) {
    /**
     * Notification that heartbeats were missed. This notification is informational.
     * The `data` portion of the status, is a number indicating the number of missed heartbeats.
     * Note that when a client disconnects, heartbeat tracking is paused while
     * the client is disconnected.
     */
    ConsumerEvents["HeartbeatsMissed"] = "heartbeats_missed";
    /**
     * Notification that the consumer was not found. Consumers that were accessible at
     * least once, will be retried for more messages regardless of the not being found
     * or timeouts etc. This notification includes a count of consecutive attempts to
     * find the consumer. Note that if you get this notification possibly your code should
     * attempt to recreate the consumer. Note that this notification is only informational
     * for ordered consumers, as the consumer will be created in those cases automatically.
     */
    ConsumerEvents["ConsumerNotFound"] = "consumer_not_found";
    /**
     * Notification that the stream was not found. Consumers were accessible at least once,
     * will be retried for more messages regardless of the not being found
     * or timeouts etc. This notification includes a count of consecutive attempts to
     * find the consumer. Note that if you get this notification possibly your code should
     * attempt to recreate the consumer. Note that this notification is only informational
     * for ordered consumers, as the consumer will be created in those cases automatically.
     */
    ConsumerEvents["StreamNotFound"] = "stream_not_found";
    /*
     * Notification that the consumer was deleted. This notification
     * means the consumer will not get messages unless it is recreated. The client
     * will continue to attempt to pull messages. Ordered consumer will recreate it.
     */
    ConsumerEvents["ConsumerDeleted"] = "consumer_deleted";
    /**
     * This notification is specific of ordered consumers and will be notified whenever
     * the consumer is recreated. The argument is the name of the newly created consumer.
     */
    ConsumerEvents["OrderedConsumerRecreated"] = "ordered_consumer_recreated";
    /**
     * This notification means that either both the stream and consumer were not
     * found or that JetStream is not available.
     */
    ConsumerEvents["NoResponders"] = "no_responders";
})(ConsumerEvents || (exports.ConsumerEvents = ConsumerEvents = {}));
/**
 * These events represent informational notifications emitted by ConsumerMessages
 * that can be safely ignored by clients.
 */
var ConsumerDebugEvents;
(function (ConsumerDebugEvents) {
    /**
     * DebugEvents are effectively statuses returned by the server that were ignored
     * by the client. The `data` portion of the
     * status is just a string indicating the code/message of the status.
     */
    ConsumerDebugEvents["DebugEvent"] = "debug";
    /**
     * Requests for messages can be terminated by the server, these notifications
     * provide information on the number of messages and/or bytes that couldn't
     * be satisfied by the consumer request. The `data` portion of the status will
     * have the format of `{msgsLeft: number, bytesLeft: number}`.
     */
    ConsumerDebugEvents["Discard"] = "discard";
    /**
     * Notifies that the current consumer will be reset
     */
    ConsumerDebugEvents["Reset"] = "reset";
    /**
     * Notifies whenever there's a request for additional messages from the server.
     * This notification telegraphs the request options, which should be treated as
     * read-only. This notification is only useful for debugging. Data is PullOptions.
     */
    ConsumerDebugEvents["Next"] = "next";
})(ConsumerDebugEvents || (exports.ConsumerDebugEvents = ConsumerDebugEvents = {}));
class PullConsumerMessagesImpl extends queued_iterator_1.QueuedIteratorImpl {
    // callback: ConsumerCallbackFn;
    constructor(c, opts, refilling = false) {
        super();
        this.consumer = c;
        const copts = opts;
        this.opts = this.parseOptions(opts, refilling);
        this.callback = copts.callback || null;
        this.noIterator = typeof this.callback === "function";
        this.monitor = null;
        this.pong = null;
        this.pending = { msgs: 0, bytes: 0, requests: 0 };
        this.refilling = refilling;
        this.timeout = null;
        this.inbox = (0, core_1.createInbox)(c.api.nc.options.inboxPrefix);
        this.listeners = [];
        this.forOrderedConsumer = false;
        this.abortOnMissingResource = copts.abort_on_missing_resource === true;
        this.bind = copts.bind === true;
        this.inBackOff = false;
        this.start();
    }
    start() {
        const { max_messages, max_bytes, idle_heartbeat, threshold_bytes, threshold_messages, } = this.opts;
        // ordered consumer requires the ability to reset the
        // source pull consumer, if promise is registered and
        // close is called, the pull consumer will emit a close
        // which will close the ordered consumer, by registering
        // the close with a handler, we can replace it.
        this.closed().then((err) => {
            if (this.cleanupHandler) {
                try {
                    this.cleanupHandler(err);
                }
                catch (_err) {
                    // nothing
                }
            }
        });
        const { sub } = this;
        if (sub) {
            sub.unsubscribe();
        }
        this.sub = this.consumer.api.nc.subscribe(this.inbox, {
            callback: (err, msg) => {
                var _a, _b, _c, _d;
                if (err) {
                    // this is possibly only a permissions error which means
                    // that the server rejected (eliminating the sub)
                    // or the client never had permissions to begin with
                    // so this is terminal
                    this.stop(err);
                    return;
                }
                (_a = this.monitor) === null || _a === void 0 ? void 0 : _a.work();
                const isProtocol = msg.subject === this.inbox;
                if (isProtocol) {
                    if ((0, jsutil_1.isHeartbeatMsg)(msg)) {
                        return;
                    }
                    const code = (_b = msg.headers) === null || _b === void 0 ? void 0 : _b.code;
                    const description = ((_d = (_c = msg.headers) === null || _c === void 0 ? void 0 : _c.description) === null || _d === void 0 ? void 0 : _d.toLowerCase()) ||
                        "unknown";
                    const { msgsLeft, bytesLeft } = this.parseDiscard(msg.headers);
                    if (msgsLeft > 0 || bytesLeft > 0) {
                        this.pending.msgs -= msgsLeft;
                        this.pending.bytes -= bytesLeft;
                        this.pending.requests--;
                        this.notify(ConsumerDebugEvents.Discard, { msgsLeft, bytesLeft });
                    }
                    else {
                        // FIXME: 408 can be a Timeout or bad request,
                        //  or it can be sent if a nowait request was
                        //  sent when other waiting requests are pending
                        //  "Requests Pending"
                        // FIXME: 400 bad request Invalid Heartbeat or Unmarshalling Fails
                        //  these are real bad values - so this is bad request
                        //  fail on this
                        // we got a bad request - no progress here
                        if (code === 400) {
                            this.stop(new core_1.NatsError(description, `${code}`));
                            return;
                        }
                        else if (code === 409 && description === "consumer deleted") {
                            this.notify(ConsumerEvents.ConsumerDeleted, `${code} ${description}`);
                            if (!this.refilling || this.abortOnMissingResource) {
                                const error = new core_1.NatsError(description, `${code}`);
                                this.stop(error);
                                return;
                            }
                        }
                        else if (code === 503) {
                            // this is a no responders - possibly the stream/consumer were
                            // deleted from under the client
                            this.notify(ConsumerEvents.NoResponders, `${code} No Responders`);
                            // in cases that we are in consume, the idle heartbeat will kick in
                            // which will do a reset, and possibly refine the error
                            if (!this.refilling || this.abortOnMissingResource) {
                                const error = new core_1.NatsError("no responders", `${code}`);
                                this.stop(error);
                                return;
                            }
                        }
                        else {
                            this.notify(ConsumerDebugEvents.DebugEvent, `${code} ${description}`);
                        }
                    }
                }
                else {
                    // push the user message
                    this._push((0, jsmsg_1.toJsMsg)(msg, this.consumer.api.timeout));
                    this.received++;
                    if (this.pending.msgs) {
                        this.pending.msgs--;
                    }
                    if (this.pending.bytes) {
                        this.pending.bytes -= msg.size();
                    }
                }
                // if we don't have pending bytes/messages we are done or starving
                if (this.pending.msgs === 0 && this.pending.bytes === 0) {
                    this.pending.requests = 0;
                }
                if (this.refilling) {
                    // FIXME: this could result in  1/4 = 0
                    if ((max_messages &&
                        this.pending.msgs <= threshold_messages) ||
                        (max_bytes && this.pending.bytes <= threshold_bytes)) {
                        const batch = this.pullOptions();
                        // @ts-ignore: we are pushing the pull fn
                        this.pull(batch);
                    }
                }
                else if (this.pending.requests === 0) {
                    // @ts-ignore: we are pushing the pull fn
                    this._push(() => {
                        this.stop();
                    });
                }
            },
        });
        this.sub.closed.then(() => {
            // for ordered consumer we cannot break the iterator
            if (this.sub.draining) {
                // @ts-ignore: we are pushing the pull fn
                this._push(() => {
                    this.stop();
                });
            }
        });
        if (idle_heartbeat) {
            this.monitor = new idleheartbeat_monitor_1.IdleHeartbeatMonitor(idle_heartbeat, (data) => {
                // for the pull consumer - missing heartbeats may be corrected
                // on the next pull etc - the only assumption here is we should
                // reset and check if the consumer was deleted from under us
                this.notify(ConsumerEvents.HeartbeatsMissed, data);
                this.resetPending()
                    .then(() => {
                })
                    .catch(() => {
                });
                return false;
            }, { maxOut: 2 });
        }
        // now if we disconnect, the consumer could be gone
        // or we were slow consumer'ed by the server
        (() => __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d;
            const status = this.consumer.api.nc.status();
            this.statusIterator = status;
            try {
                for (var _e = true, status_1 = __asyncValues(status), status_1_1; status_1_1 = yield status_1.next(), _a = status_1_1.done, !_a; _e = true) {
                    _c = status_1_1.value;
                    _e = false;
                    const s = _c;
                    switch (s.type) {
                        case core_1.Events.Disconnect:
                            // don't spam hb errors if we are disconnected
                            // @ts-ignore: optional chaining
                            (_d = this.monitor) === null || _d === void 0 ? void 0 : _d.cancel();
                            break;
                        case core_1.Events.Reconnect:
                            // do some sanity checks and reset
                            // if that works resume the monitor
                            this.resetPending()
                                .then((ok) => {
                                var _a;
                                if (ok) {
                                    // @ts-ignore: optional chaining
                                    (_a = this.monitor) === null || _a === void 0 ? void 0 : _a.restart();
                                }
                            })
                                .catch(() => {
                                // ignored - this should have fired elsewhere
                            });
                            break;
                        default:
                        // ignored
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_e && !_a && (_b = status_1.return)) yield _b.call(status_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }))();
        // this is the initial pull
        this.pull(this.pullOptions());
    }
    _push(r) {
        if (!this.callback) {
            super.push(r);
        }
        else {
            const fn = typeof r === "function" ? r : null;
            try {
                if (!fn) {
                    this.callback(r);
                }
                else {
                    fn();
                }
            }
            catch (err) {
                this.stop(err);
            }
        }
    }
    notify(type, data) {
        if (this.listeners.length > 0) {
            (() => {
                this.listeners.forEach((l) => {
                    if (!l.done) {
                        l.push({ type, data });
                    }
                });
            })();
        }
    }
    resetPending() {
        return this.bind ? this.resetPendingNoInfo() : this.resetPendingWithInfo();
    }
    resetPendingNoInfo() {
        // here we are blind - we won't do an info, so all we are doing
        // is invalidating the previous request results.
        this.pending.msgs = 0;
        this.pending.bytes = 0;
        this.pending.requests = 0;
        this.pull(this.pullOptions());
        return Promise.resolve(true);
    }
    resetPendingWithInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inBackOff) {
                // already failing to get stream or consumer
                return false;
            }
            let notFound = 0;
            let streamNotFound = 0;
            const bo = (0, util_1.backoff)([this.opts.expires]);
            let attempt = 0;
            while (true) {
                if (this.done) {
                    return false;
                }
                if (this.consumer.api.nc.isClosed()) {
                    console.error("aborting resetPending - connection is closed");
                    return false;
                }
                try {
                    // check we exist
                    yield this.consumer.info();
                    this.inBackOff = false;
                    notFound = 0;
                    // we exist, so effectively any pending state is gone
                    // so reset and re-pull
                    this.pending.msgs = 0;
                    this.pending.bytes = 0;
                    this.pending.requests = 0;
                    this.pull(this.pullOptions());
                    return true;
                }
                catch (err) {
                    // game over
                    if (err.message === "stream not found") {
                        streamNotFound++;
                        this.notify(ConsumerEvents.StreamNotFound, streamNotFound);
                        if (!this.refilling || this.abortOnMissingResource) {
                            this.stop(err);
                            return false;
                        }
                    }
                    else if (err.message === "consumer not found") {
                        notFound++;
                        this.notify(ConsumerEvents.ConsumerNotFound, notFound);
                        if (this.resetHandler) {
                            try {
                                this.resetHandler();
                            }
                            catch (_) {
                                // ignored
                            }
                        }
                        if (!this.refilling || this.abortOnMissingResource) {
                            this.stop(err);
                            return false;
                        }
                        if (this.forOrderedConsumer) {
                            return false;
                        }
                    }
                    else {
                        notFound = 0;
                        streamNotFound = 0;
                    }
                    this.inBackOff = true;
                    const to = bo.backoff(attempt);
                    // wait for delay or till the client closes
                    const de = (0, util_1.delay)(to);
                    yield Promise.race([de, this.consumer.api.nc.closed()]);
                    de.cancel();
                    attempt++;
                }
            }
        });
    }
    pull(opts) {
        var _a, _b;
        this.pending.bytes += (_a = opts.max_bytes) !== null && _a !== void 0 ? _a : 0;
        this.pending.msgs += (_b = opts.batch) !== null && _b !== void 0 ? _b : 0;
        this.pending.requests++;
        const nc = this.consumer.api.nc;
        //@ts-ignore: iterator will pull
        this._push(() => {
            nc.publish(`${this.consumer.api.prefix}.CONSUMER.MSG.NEXT.${this.consumer.stream}.${this.consumer.name}`, this.consumer.api.jc.encode(opts), { reply: this.inbox });
            this.notify(ConsumerDebugEvents.Next, opts);
        });
    }
    pullOptions() {
        const batch = this.opts.max_messages - this.pending.msgs;
        const max_bytes = this.opts.max_bytes - this.pending.bytes;
        const idle_heartbeat = (0, util_1.nanos)(this.opts.idle_heartbeat);
        const expires = (0, util_1.nanos)(this.opts.expires);
        return { batch, max_bytes, idle_heartbeat, expires };
    }
    parseDiscard(headers) {
        const discard = {
            msgsLeft: 0,
            bytesLeft: 0,
        };
        const msgsLeft = headers === null || headers === void 0 ? void 0 : headers.get(types_1.JsHeaders.PendingMessagesHdr);
        if (msgsLeft) {
            discard.msgsLeft = parseInt(msgsLeft);
        }
        const bytesLeft = headers === null || headers === void 0 ? void 0 : headers.get(types_1.JsHeaders.PendingBytesHdr);
        if (bytesLeft) {
            discard.bytesLeft = parseInt(bytesLeft);
        }
        return discard;
    }
    trackTimeout(t) {
        this.timeout = t;
    }
    close() {
        this.stop();
        return this.iterClosed;
    }
    closed() {
        return this.iterClosed;
    }
    clearTimers() {
        var _a, _b;
        (_a = this.monitor) === null || _a === void 0 ? void 0 : _a.cancel();
        this.monitor = null;
        (_b = this.timeout) === null || _b === void 0 ? void 0 : _b.cancel();
        this.timeout = null;
    }
    setCleanupHandler(fn) {
        this.cleanupHandler = fn;
    }
    stop(err) {
        var _a, _b;
        if (this.done) {
            return;
        }
        (_a = this.sub) === null || _a === void 0 ? void 0 : _a.unsubscribe();
        this.clearTimers();
        (_b = this.statusIterator) === null || _b === void 0 ? void 0 : _b.stop();
        //@ts-ignore: fn
        this._push(() => {
            super.stop(err);
            this.listeners.forEach((n) => {
                n.stop();
            });
        });
    }
    parseOptions(opts, refilling = false) {
        const args = (opts || {});
        args.max_messages = args.max_messages || 0;
        args.max_bytes = args.max_bytes || 0;
        if (args.max_messages !== 0 && args.max_bytes !== 0) {
            throw new Error(`only specify one of max_messages or max_bytes`);
        }
        // we must have at least one limit - default to 100 msgs
        // if they gave bytes but no messages, we will clamp
        // if they gave byte limits, we still need a message limit
        // or the server will send a single message and close the
        // request
        if (args.max_messages === 0) {
            // FIXME: if the server gives end pull completion, then this is not
            //   needed - the client will get 1 message but, we'll know that it
            //   worked - but we'll add a lot of latency, since all requests
            //   will end after one message
            args.max_messages = 100;
        }
        args.expires = args.expires || 30000;
        if (args.expires < 1000) {
            throw new Error("expires should be at least 1000ms");
        }
        // require idle_heartbeat
        args.idle_heartbeat = args.idle_heartbeat || args.expires / 2;
        args.idle_heartbeat = args.idle_heartbeat > 30000
            ? 30000
            : args.idle_heartbeat;
        if (refilling) {
            const minMsgs = Math.round(args.max_messages * .75) || 1;
            args.threshold_messages = args.threshold_messages || minMsgs;
            const minBytes = Math.round(args.max_bytes * .75) || 1;
            args.threshold_bytes = args.threshold_bytes || minBytes;
        }
        return args;
    }
    status() {
        const iter = new queued_iterator_1.QueuedIteratorImpl();
        this.listeners.push(iter);
        return Promise.resolve(iter);
    }
}
exports.PullConsumerMessagesImpl = PullConsumerMessagesImpl;
class OrderedConsumerMessages extends queued_iterator_1.QueuedIteratorImpl {
    constructor() {
        super();
        this.listeners = [];
    }
    setSource(src) {
        if (this.src) {
            this.src.resetHandler = undefined;
            this.src.setCleanupHandler();
            this.src.stop();
        }
        this.src = src;
        this.src.setCleanupHandler((err) => {
            this.stop(err || undefined);
        });
        (() => __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            const status = yield this.src.status();
            try {
                for (var _d = true, status_2 = __asyncValues(status), status_2_1; status_2_1 = yield status_2.next(), _a = status_2_1.done, !_a; _d = true) {
                    _c = status_2_1.value;
                    _d = false;
                    const s = _c;
                    this.notify(s.type, s.data);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = status_2.return)) yield _b.call(status_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }))().catch(() => { });
    }
    notify(type, data) {
        if (this.listeners.length > 0) {
            (() => {
                this.listeners.forEach((l) => {
                    if (!l.done) {
                        l.push({ type, data });
                    }
                });
            })();
        }
    }
    stop(err) {
        var _a;
        if (this.done) {
            return;
        }
        (_a = this.src) === null || _a === void 0 ? void 0 : _a.stop(err);
        super.stop(err);
        this.listeners.forEach((n) => {
            n.stop();
        });
    }
    close() {
        this.stop();
        return this.iterClosed;
    }
    closed() {
        return this.iterClosed;
    }
    status() {
        const iter = new queued_iterator_1.QueuedIteratorImpl();
        this.listeners.push(iter);
        return Promise.resolve(iter);
    }
}
exports.OrderedConsumerMessages = OrderedConsumerMessages;
class PullConsumerImpl {
    constructor(api, info) {
        this.api = api;
        this._info = info;
        this.stream = info.stream_name;
        this.name = info.name;
    }
    consume(opts = {
        max_messages: 100,
        expires: 30000,
    }) {
        return Promise.resolve(new PullConsumerMessagesImpl(this, opts, true));
    }
    fetch(opts = {
        max_messages: 100,
        expires: 30000,
    }) {
        const m = new PullConsumerMessagesImpl(this, opts, false);
        // FIXME: need some way to pad this correctly
        const to = Math.round(m.opts.expires * 1.05);
        const timer = (0, util_1.timeout)(to);
        m.closed().catch(() => {
        }).finally(() => {
            timer.cancel();
        });
        timer.catch(() => {
            m.close().catch();
        });
        m.trackTimeout(timer);
        return Promise.resolve(m);
    }
    next(opts = { expires: 30000 }) {
        const d = (0, util_1.deferred)();
        const fopts = opts;
        fopts.max_messages = 1;
        const iter = new PullConsumerMessagesImpl(this, fopts, false);
        // FIXME: need some way to pad this correctly
        const to = Math.round(iter.opts.expires * 1.05);
        // watch the messages for heartbeats missed
        if (to >= 60000) {
            (() => __awaiter(this, void 0, void 0, function* () {
                var _a, e_3, _b, _c;
                try {
                    for (var _d = true, _e = __asyncValues(yield iter.status()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                        _c = _f.value;
                        _d = false;
                        const s = _c;
                        if (s.type === ConsumerEvents.HeartbeatsMissed &&
                            s.data >= 2) {
                            d.reject(new Error("consumer missed heartbeats"));
                            break;
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
            }))().catch();
        }
        (() => __awaiter(this, void 0, void 0, function* () {
            var _a, e_4, _b, _c;
            try {
                for (var _d = true, iter_1 = __asyncValues(iter), iter_1_1; iter_1_1 = yield iter_1.next(), _a = iter_1_1.done, !_a; _d = true) {
                    _c = iter_1_1.value;
                    _d = false;
                    const m = _c;
                    d.resolve(m);
                    break;
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = iter_1.return)) yield _b.call(iter_1);
                }
                finally { if (e_4) throw e_4.error; }
            }
        }))().catch(() => {
            // iterator is going to throw, but we ignore it
            // as it is handled by the closed promise
        });
        const timer = (0, util_1.timeout)(to);
        iter.closed().then((err) => {
            err ? d.reject(err) : d.resolve(null);
        }).catch((err) => {
            d.reject(err);
        }).finally(() => {
            timer.cancel();
        });
        timer.catch((_err) => {
            d.resolve(null);
            iter.close().catch();
        });
        iter.trackTimeout(timer);
        return d;
    }
    delete() {
        const { stream_name, name } = this._info;
        return this.api.delete(stream_name, name);
    }
    info(cached = false) {
        if (cached) {
            return Promise.resolve(this._info);
        }
        const { stream_name, name } = this._info;
        return this.api.info(stream_name, name)
            .then((ci) => {
            this._info = ci;
            return this._info;
        });
    }
}
exports.PullConsumerImpl = PullConsumerImpl;
class OrderedPullConsumerImpl {
    constructor(api, stream, opts = {}) {
        this.api = api;
        this.stream = stream;
        this.cursor = { stream_seq: 1, deliver_seq: 0 };
        this.namePrefix = nuid_1.nuid.next();
        if (typeof opts.name_prefix === "string") {
            // make sure the prefix is valid
            (0, jsutil_1.minValidation)("name_prefix", opts.name_prefix);
            this.namePrefix = opts.name_prefix + this.namePrefix;
        }
        this.serial = 0;
        this.currentConsumer = null;
        this.userCallback = null;
        this.iter = null;
        this.type = PullConsumerType.Unset;
        this.consumerOpts = opts;
        this.maxInitialReset = 30;
        // to support a random start sequence we need to update the cursor
        this.startSeq = this.consumerOpts.opt_start_seq || 0;
        this.cursor.stream_seq = this.startSeq > 0 ? this.startSeq - 1 : 0;
    }
    getConsumerOpts(seq) {
        // change the serial - invalidating any callback not
        // matching the serial
        this.serial++;
        const name = `${this.namePrefix}_${this.serial}`;
        seq = seq === 0 ? 1 : seq;
        const config = {
            name,
            deliver_policy: jsapi_types_1.DeliverPolicy.StartSequence,
            opt_start_seq: seq,
            ack_policy: jsapi_types_1.AckPolicy.None,
            inactive_threshold: (0, util_1.nanos)(5 * 60 * 1000),
            num_replicas: 1,
        };
        if (this.consumerOpts.headers_only === true) {
            config.headers_only = true;
        }
        if (Array.isArray(this.consumerOpts.filterSubjects)) {
            config.filter_subjects = this.consumerOpts.filterSubjects;
        }
        if (typeof this.consumerOpts.filterSubjects === "string") {
            config.filter_subject = this.consumerOpts.filterSubjects;
        }
        if (this.consumerOpts.replay_policy) {
            config.replay_policy = this.consumerOpts.replay_policy;
        }
        // this is the initial request - tweak some options
        if (seq === this.startSeq + 1) {
            config.deliver_policy = this.consumerOpts.deliver_policy ||
                jsapi_types_1.DeliverPolicy.StartSequence;
            if (this.consumerOpts.deliver_policy === jsapi_types_1.DeliverPolicy.LastPerSubject ||
                this.consumerOpts.deliver_policy === jsapi_types_1.DeliverPolicy.New ||
                this.consumerOpts.deliver_policy === jsapi_types_1.DeliverPolicy.Last) {
                delete config.opt_start_seq;
                config.deliver_policy = this.consumerOpts.deliver_policy;
            }
            // this requires a filter subject - we only set if they didn't
            // set anything, and to be pre-2.10 we set it as filter_subject
            if (config.deliver_policy === jsapi_types_1.DeliverPolicy.LastPerSubject) {
                if (typeof config.filter_subjects === "undefined" &&
                    typeof config.filter_subject === "undefined") {
                    config.filter_subject = ">";
                }
            }
            if (this.consumerOpts.opt_start_time) {
                delete config.opt_start_seq;
                config.deliver_policy = jsapi_types_1.DeliverPolicy.StartTime;
                config.opt_start_time = this.consumerOpts.opt_start_time;
            }
            if (this.consumerOpts.inactive_threshold) {
                config.inactive_threshold = (0, util_1.nanos)(this.consumerOpts.inactive_threshold);
            }
        }
        return config;
    }
    resetConsumer() {
        return __awaiter(this, arguments, void 0, function* (seq = 0) {
            var _a, _b, _c, _d, _e;
            const id = nuid_1.nuid.next();
            const isNew = this.serial === 0;
            // try to delete the consumer
            (_a = this.consumer) === null || _a === void 0 ? void 0 : _a.delete().catch(() => { });
            seq = seq === 0 ? 1 : seq;
            // reset the consumer sequence as JetStream will renumber from 1
            this.cursor.deliver_seq = 0;
            const config = this.getConsumerOpts(seq);
            config.max_deliver = 1;
            config.mem_storage = true;
            const bo = (0, util_1.backoff)([((_b = this.opts) === null || _b === void 0 ? void 0 : _b.expires) || 30000]);
            let ci;
            for (let i = 0;; i++) {
                try {
                    ci = yield this.api.add(this.stream, config);
                    (_c = this.iter) === null || _c === void 0 ? void 0 : _c.notify(ConsumerEvents.OrderedConsumerRecreated, ci.name);
                    break;
                }
                catch (err) {
                    if (err.message === "stream not found") {
                        // we are not going to succeed
                        (_d = this.iter) === null || _d === void 0 ? void 0 : _d.notify(ConsumerEvents.StreamNotFound, i);
                        // if we are not consume - fail it
                        if (this.type === PullConsumerType.Fetch ||
                            this.opts.abort_on_missing_resource === true) {
                            (_e = this.iter) === null || _e === void 0 ? void 0 : _e.stop(err);
                            return Promise.reject(err);
                        }
                    }
                    if (isNew && i >= this.maxInitialReset) {
                        // consumer was never created, so we can fail this
                        throw err;
                    }
                    else {
                        yield (0, util_1.delay)(bo.backoff(i + 1));
                    }
                }
            }
            return ci;
        });
    }
    internalHandler(serial) {
        // this handler will be noop if the consumer's serial changes
        return (m) => {
            var _a;
            if (this.serial !== serial) {
                return;
            }
            const dseq = m.info.deliverySequence;
            if (dseq !== this.cursor.deliver_seq + 1) {
                this.notifyOrderedResetAndReset();
                return;
            }
            this.cursor.deliver_seq = dseq;
            this.cursor.stream_seq = m.info.streamSequence;
            if (this.userCallback) {
                this.userCallback(m);
            }
            else {
                (_a = this.iter) === null || _a === void 0 ? void 0 : _a.push(m);
            }
        };
    }
    reset() {
        return __awaiter(this, arguments, void 0, function* (opts = {
            max_messages: 100,
            expires: 30000,
        }, info) {
            var _a, _b;
            info = info || {};
            // this is known to be directly related to a pull
            const fromFetch = info.fromFetch || false;
            // a sequence order caused the reset
            const orderedReset = info.orderedReset || false;
            if (this.type === PullConsumerType.Fetch && orderedReset) {
                // the fetch pull simply needs to end the iterator
                (_a = this.iter) === null || _a === void 0 ? void 0 : _a.src.stop();
                yield ((_b = this.iter) === null || _b === void 0 ? void 0 : _b.closed());
                this.currentConsumer = null;
                return;
            }
            if (this.currentConsumer === null || orderedReset) {
                this.currentConsumer = yield this.resetConsumer(this.cursor.stream_seq + 1);
            }
            // if we don't have an iterator, or it is a fetch request
            // we create the iterator - otherwise this is a reset that is happening
            // while the OC is active, so simply bind the new OC to current iterator.
            if (this.iter === null || fromFetch) {
                this.iter = new OrderedConsumerMessages();
            }
            this.consumer = new PullConsumerImpl(this.api, this.currentConsumer);
            const copts = opts;
            copts.callback = this.internalHandler(this.serial);
            let msgs = null;
            if (this.type === PullConsumerType.Fetch && fromFetch) {
                // we only repull if client initiates
                msgs = yield this.consumer.fetch(opts);
            }
            else if (this.type === PullConsumerType.Consume) {
                msgs = yield this.consumer.consume(opts);
            }
            const msgsImpl = msgs;
            msgsImpl.forOrderedConsumer = true;
            msgsImpl.resetHandler = () => {
                this.notifyOrderedResetAndReset();
            };
            this.iter.setSource(msgsImpl);
        });
    }
    notifyOrderedResetAndReset() {
        var _a;
        (_a = this.iter) === null || _a === void 0 ? void 0 : _a.notify(ConsumerDebugEvents.Reset, "");
        this.reset(this.opts, { orderedReset: true });
    }
    consume() {
        return __awaiter(this, arguments, void 0, function* (opts = {
            max_messages: 100,
            expires: 30000,
        }) {
            const copts = opts;
            if (copts.bind) {
                return Promise.reject(new Error("bind is not supported"));
            }
            if (this.type === PullConsumerType.Fetch) {
                return Promise.reject(new Error("ordered consumer initialized as fetch"));
            }
            if (this.type === PullConsumerType.Consume) {
                return Promise.reject(new Error("ordered consumer doesn't support concurrent consume"));
            }
            const { callback } = opts;
            if (callback) {
                this.userCallback = callback;
            }
            this.type = PullConsumerType.Consume;
            this.opts = opts;
            yield this.reset(opts);
            return this.iter;
        });
    }
    fetch() {
        return __awaiter(this, arguments, void 0, function* (opts = { max_messages: 100, expires: 30000 }) {
            var _a;
            const copts = opts;
            if (copts.bind) {
                return Promise.reject(new Error("bind is not supported"));
            }
            if (this.type === PullConsumerType.Consume) {
                return Promise.reject(new Error("ordered consumer already initialized as consume"));
            }
            if (((_a = this.iter) === null || _a === void 0 ? void 0 : _a.done) === false) {
                return Promise.reject(new Error("ordered consumer doesn't support concurrent fetch"));
            }
            //@ts-ignore: allow this for tests - api doesn't use it because
            // iterator close is the user signal that the pull is done.
            const { callback } = opts;
            if (callback) {
                this.userCallback = callback;
            }
            this.type = PullConsumerType.Fetch;
            this.opts = opts;
            yield this.reset(opts, { fromFetch: true });
            return this.iter;
        });
    }
    next() {
        return __awaiter(this, arguments, void 0, function* (opts = { expires: 30000 }) {
            const copts = opts;
            if (copts.bind) {
                return Promise.reject(new Error("bind is not supported"));
            }
            copts.max_messages = 1;
            const d = (0, util_1.deferred)();
            copts.callback = (m) => {
                // we can clobber the callback, because they are not supported
                // except on consume, which will fail when we try to fetch
                this.userCallback = null;
                d.resolve(m);
            };
            const iter = yield this.fetch(copts);
            iter.iterClosed
                .then((err) => {
                if (err) {
                    d.reject(err);
                }
                d.resolve(null);
            })
                .catch((err) => {
                d.reject(err);
            });
            return d;
        });
    }
    delete() {
        if (!this.currentConsumer) {
            return Promise.resolve(false);
        }
        return this.api.delete(this.stream, this.currentConsumer.name)
            .then((tf) => {
            return Promise.resolve(tf);
        })
            .catch((err) => {
            return Promise.reject(err);
        })
            .finally(() => {
            this.currentConsumer = null;
        });
    }
    info(cached) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentConsumer == null) {
                this.currentConsumer = yield this.resetConsumer(this.startSeq);
                return Promise.resolve(this.currentConsumer);
            }
            if (cached && this.currentConsumer) {
                return Promise.resolve(this.currentConsumer);
            }
            return this.api.info(this.stream, this.currentConsumer.name);
        });
    }
}
exports.OrderedPullConsumerImpl = OrderedPullConsumerImpl;
//# sourceMappingURL=consumer.js.map