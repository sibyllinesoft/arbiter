"use strict";
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
exports.JetStreamSubscriptionImpl = exports.JetStreamClientImpl = exports.PubHeaders = void 0;
const types_1 = require("../nats-base-client/types");
const jsbaseclient_api_1 = require("./jsbaseclient_api");
const jsutil_1 = require("./jsutil");
const jsmconsumer_api_1 = require("./jsmconsumer_api");
const jsmsg_1 = require("./jsmsg");
const typedsub_1 = require("../nats-base-client/typedsub");
const queued_iterator_1 = require("../nats-base-client/queued_iterator");
const util_1 = require("../nats-base-client/util");
const headers_1 = require("../nats-base-client/headers");
const kv_1 = require("./kv");
const semver_1 = require("../nats-base-client/semver");
const objectstore_1 = require("./objectstore");
const idleheartbeat_monitor_1 = require("../nats-base-client/idleheartbeat_monitor");
const jsmstream_api_1 = require("./jsmstream_api");
const types_2 = require("./types");
const core_1 = require("../nats-base-client/core");
const jsapi_types_1 = require("./jsapi_types");
const nuid_1 = require("../nats-base-client/nuid");
var PubHeaders;
(function (PubHeaders) {
    PubHeaders["MsgIdHdr"] = "Nats-Msg-Id";
    PubHeaders["ExpectedStreamHdr"] = "Nats-Expected-Stream";
    PubHeaders["ExpectedLastSeqHdr"] = "Nats-Expected-Last-Sequence";
    PubHeaders["ExpectedLastMsgIdHdr"] = "Nats-Expected-Last-Msg-Id";
    PubHeaders["ExpectedLastSubjectSequenceHdr"] = "Nats-Expected-Last-Subject-Sequence";
})(PubHeaders || (exports.PubHeaders = PubHeaders = {}));
class ViewsImpl {
    constructor(js) {
        this.js = js;
    }
    kv(name, opts = {}) {
        const jsi = this.js;
        const { ok, min } = jsi.nc.features.get(semver_1.Feature.JS_KV);
        if (!ok) {
            return Promise.reject(new Error(`kv is only supported on servers ${min} or better`));
        }
        if (opts.bindOnly) {
            return kv_1.Bucket.bind(this.js, name, opts);
        }
        return kv_1.Bucket.create(this.js, name, opts);
    }
    os(name, opts = {}) {
        var _a;
        if (typeof ((_a = crypto === null || crypto === void 0 ? void 0 : crypto.subtle) === null || _a === void 0 ? void 0 : _a.digest) !== "function") {
            return Promise.reject(new Error("objectstore: unable to calculate hashes - crypto.subtle.digest with sha256 support is required"));
        }
        const jsi = this.js;
        const { ok, min } = jsi.nc.features.get(semver_1.Feature.JS_OBJECTSTORE);
        if (!ok) {
            return Promise.reject(new Error(`objectstore is only supported on servers ${min} or better`));
        }
        return objectstore_1.ObjectStoreImpl.create(this.js, name, opts);
    }
}
class JetStreamClientImpl extends jsbaseclient_api_1.BaseApiClient {
    constructor(nc, opts) {
        super(nc, opts);
        this.consumerAPI = new jsmconsumer_api_1.ConsumerAPIImpl(nc, opts);
        this.streamAPI = new jsmstream_api_1.StreamAPIImpl(nc, opts);
        this.consumers = new jsmstream_api_1.ConsumersImpl(this.consumerAPI);
        this.streams = new jsmstream_api_1.StreamsImpl(this.streamAPI);
    }
    jetstreamManager(checkAPI) {
        if (checkAPI === undefined) {
            checkAPI = this.opts.checkAPI;
        }
        const opts = Object.assign({}, this.opts, { checkAPI });
        return this.nc.jetstreamManager(opts);
    }
    get apiPrefix() {
        return this.prefix;
    }
    get views() {
        return new ViewsImpl(this);
    }
    publish(subj_1) {
        return __awaiter(this, arguments, void 0, function* (subj, data = types_1.Empty, opts) {
            opts = opts || {};
            opts.expect = opts.expect || {};
            const mh = (opts === null || opts === void 0 ? void 0 : opts.headers) || (0, headers_1.headers)();
            if (opts) {
                if (opts.msgID) {
                    mh.set(PubHeaders.MsgIdHdr, opts.msgID);
                }
                if (opts.expect.lastMsgID) {
                    mh.set(PubHeaders.ExpectedLastMsgIdHdr, opts.expect.lastMsgID);
                }
                if (opts.expect.streamName) {
                    mh.set(PubHeaders.ExpectedStreamHdr, opts.expect.streamName);
                }
                if (typeof opts.expect.lastSequence === "number") {
                    mh.set(PubHeaders.ExpectedLastSeqHdr, `${opts.expect.lastSequence}`);
                }
                if (typeof opts.expect.lastSubjectSequence === "number") {
                    mh.set(PubHeaders.ExpectedLastSubjectSequenceHdr, `${opts.expect.lastSubjectSequence}`);
                }
            }
            const to = opts.timeout || this.timeout;
            const ro = {};
            if (to) {
                ro.timeout = to;
            }
            if (opts) {
                ro.headers = mh;
            }
            let { retries, retry_delay } = opts;
            retries = retries || 1;
            retry_delay = retry_delay || 250;
            let r;
            for (let i = 0; i < retries; i++) {
                try {
                    r = yield this.nc.request(subj, data, ro);
                    // if here we succeeded
                    break;
                }
                catch (err) {
                    const ne = err;
                    if (ne.code === "503" && i + 1 < retries) {
                        yield (0, util_1.delay)(retry_delay);
                    }
                    else {
                        throw err;
                    }
                }
            }
            const pa = this.parseJsResponse(r);
            if (pa.stream === "") {
                throw types_1.NatsError.errorForCode(core_1.ErrorCode.JetStreamInvalidAck);
            }
            pa.duplicate = pa.duplicate ? pa.duplicate : false;
            return pa;
        });
    }
    pull(stream_1, durable_1) {
        return __awaiter(this, arguments, void 0, function* (stream, durable, expires = 0) {
            (0, jsutil_1.validateStreamName)(stream);
            (0, jsutil_1.validateDurableName)(durable);
            let timeout = this.timeout;
            if (expires > timeout) {
                timeout = expires;
            }
            expires = expires < 0 ? 0 : (0, util_1.nanos)(expires);
            const pullOpts = {
                batch: 1,
                no_wait: expires === 0,
                expires,
            };
            const msg = yield this.nc.request(`${this.prefix}.CONSUMER.MSG.NEXT.${stream}.${durable}`, this.jc.encode(pullOpts), { noMux: true, timeout });
            const err = (0, jsutil_1.checkJsError)(msg);
            if (err) {
                throw err;
            }
            return (0, jsmsg_1.toJsMsg)(msg, this.timeout);
        });
    }
    /*
     * Returns available messages upto specified batch count.
     * If expires is set the iterator will wait for the specified
     * amount of millis before closing the subscription.
     * If no_wait is specified, the iterator will return no messages.
     * @param stream
     * @param durable
     * @param opts
     */
    fetch(stream, durable, opts = {}) {
        var _a;
        (0, jsutil_1.validateStreamName)(stream);
        (0, jsutil_1.validateDurableName)(durable);
        let timer = null;
        const trackBytes = ((_a = opts.max_bytes) !== null && _a !== void 0 ? _a : 0) > 0;
        let receivedBytes = 0;
        const max_bytes = trackBytes ? opts.max_bytes : 0;
        let monitor = null;
        const args = {};
        args.batch = opts.batch || 1;
        if (max_bytes) {
            const fv = this.nc.features.get(semver_1.Feature.JS_PULL_MAX_BYTES);
            if (!fv.ok) {
                throw new Error(`max_bytes is only supported on servers ${fv.min} or better`);
            }
            args.max_bytes = max_bytes;
        }
        args.no_wait = opts.no_wait || false;
        if (args.no_wait && args.expires) {
            args.expires = 0;
        }
        const expires = opts.expires || 0;
        if (expires) {
            args.expires = (0, util_1.nanos)(expires);
        }
        if (expires === 0 && args.no_wait === false) {
            throw new Error("expires or no_wait is required");
        }
        const hb = opts.idle_heartbeat || 0;
        if (hb) {
            args.idle_heartbeat = (0, util_1.nanos)(hb);
            //@ts-ignore: for testing
            if (opts.delay_heartbeat === true) {
                //@ts-ignore: test option
                args.idle_heartbeat = (0, util_1.nanos)(hb * 4);
            }
        }
        const qi = new queued_iterator_1.QueuedIteratorImpl();
        const wants = args.batch;
        let received = 0;
        qi.protocolFilterFn = (jm, _ingest = false) => {
            const jsmi = jm;
            if ((0, jsutil_1.isHeartbeatMsg)(jsmi.msg)) {
                monitor === null || monitor === void 0 ? void 0 : monitor.work();
                return false;
            }
            return true;
        };
        // FIXME: this looks weird, we want to stop the iterator
        //   but doing it from a dispatchedFn...
        qi.dispatchedFn = (m) => {
            if (m) {
                if (trackBytes) {
                    receivedBytes += m.data.length;
                }
                received++;
                if (timer && m.info.pending === 0) {
                    // the expiration will close it
                    return;
                }
                // if we have one pending and we got the expected
                // or there are no more stop the iterator
                if (qi.getPending() === 1 && m.info.pending === 0 || wants === received ||
                    (max_bytes > 0 && receivedBytes >= max_bytes)) {
                    qi.stop();
                }
            }
        };
        const inbox = (0, core_1.createInbox)(this.nc.options.inboxPrefix);
        const sub = this.nc.subscribe(inbox, {
            max: opts.batch,
            callback: (err, msg) => {
                if (err === null) {
                    err = (0, jsutil_1.checkJsError)(msg);
                }
                if (err !== null) {
                    if (timer) {
                        timer.cancel();
                        timer = null;
                    }
                    if ((0, core_1.isNatsError)(err)) {
                        qi.stop(hideNonTerminalJsErrors(err) === null ? undefined : err);
                    }
                    else {
                        qi.stop(err);
                    }
                }
                else {
                    // if we are doing heartbeats, message resets
                    monitor === null || monitor === void 0 ? void 0 : monitor.work();
                    qi.received++;
                    qi.push((0, jsmsg_1.toJsMsg)(msg, this.timeout));
                }
            },
        });
        // timer on the client  the issue is that the request
        // is started on the client, which means that it will expire
        // on the client first
        if (expires) {
            timer = (0, util_1.timeout)(expires);
            timer.catch(() => {
                if (!sub.isClosed()) {
                    sub.drain()
                        .catch(() => { });
                    timer = null;
                }
                if (monitor) {
                    monitor.cancel();
                }
            });
        }
        (() => __awaiter(this, void 0, void 0, function* () {
            try {
                if (hb) {
                    monitor = new idleheartbeat_monitor_1.IdleHeartbeatMonitor(hb, (v) => {
                        //@ts-ignore: pushing a fn
                        qi.push(() => {
                            // this will terminate the iterator
                            qi.err = new types_1.NatsError(`${jsutil_1.Js409Errors.IdleHeartbeatMissed}: ${v}`, core_1.ErrorCode.JetStreamIdleHeartBeat);
                        });
                        return true;
                    });
                }
            }
            catch (_err) {
                // ignore it
            }
            // close the iterator if the connection or subscription closes unexpectedly
            yield sub.closed;
            if (timer !== null) {
                timer.cancel();
                timer = null;
            }
            if (monitor) {
                monitor.cancel();
            }
            qi.stop();
        }))().catch();
        this.nc.publish(`${this.prefix}.CONSUMER.MSG.NEXT.${stream}.${durable}`, this.jc.encode(args), { reply: inbox });
        return qi;
    }
    pullSubscribe(subject_1) {
        return __awaiter(this, arguments, void 0, function* (subject, opts = (0, types_2.consumerOpts)()) {
            const cso = yield this._processOptions(subject, opts);
            if (cso.ordered) {
                throw new Error("pull subscribers cannot be be ordered");
            }
            if (cso.config.deliver_subject) {
                throw new Error("consumer info specifies deliver_subject - pull consumers cannot have deliver_subject set");
            }
            const ackPolicy = cso.config.ack_policy;
            if (ackPolicy === jsapi_types_1.AckPolicy.None || ackPolicy === jsapi_types_1.AckPolicy.All) {
                throw new Error("ack policy for pull consumers must be explicit");
            }
            const so = this._buildTypedSubscriptionOpts(cso);
            const sub = new JetStreamPullSubscriptionImpl(this, cso.deliver, so);
            sub.info = cso;
            try {
                yield this._maybeCreateConsumer(cso);
            }
            catch (err) {
                sub.unsubscribe();
                throw err;
            }
            return sub;
        });
    }
    subscribe(subject_1) {
        return __awaiter(this, arguments, void 0, function* (subject, opts = (0, types_2.consumerOpts)()) {
            const cso = yield this._processOptions(subject, opts);
            // this effectively requires deliver subject to be specified
            // as an option otherwise we have a pull consumer
            if (!cso.isBind && !cso.config.deliver_subject) {
                throw new Error("push consumer requires deliver_subject");
            }
            const so = this._buildTypedSubscriptionOpts(cso);
            const sub = new JetStreamSubscriptionImpl(this, cso.deliver, so);
            sub.info = cso;
            try {
                yield this._maybeCreateConsumer(cso);
            }
            catch (err) {
                sub.unsubscribe();
                throw err;
            }
            sub._maybeSetupHbMonitoring();
            return sub;
        });
    }
    _processOptions(subject_1) {
        return __awaiter(this, arguments, void 0, function* (subject, opts = (0, types_2.consumerOpts)()) {
            var _a, _b;
            const jsi = ((0, types_2.isConsumerOptsBuilder)(opts)
                ? opts.getOpts()
                : opts);
            jsi.isBind = (0, types_2.isConsumerOptsBuilder)(opts) ? opts.isBind : false;
            jsi.flow_control = {
                heartbeat_count: 0,
                fc_count: 0,
                consumer_restarts: 0,
            };
            if (jsi.ordered) {
                jsi.ordered_consumer_sequence = { stream_seq: 0, delivery_seq: 0 };
                if (jsi.config.ack_policy !== jsapi_types_1.AckPolicy.NotSet &&
                    jsi.config.ack_policy !== jsapi_types_1.AckPolicy.None) {
                    throw new types_1.NatsError("ordered consumer: ack_policy can only be set to 'none'", core_1.ErrorCode.ApiError);
                }
                if (jsi.config.durable_name && jsi.config.durable_name.length > 0) {
                    throw new types_1.NatsError("ordered consumer: durable_name cannot be set", core_1.ErrorCode.ApiError);
                }
                if (jsi.config.deliver_subject && jsi.config.deliver_subject.length > 0) {
                    throw new types_1.NatsError("ordered consumer: deliver_subject cannot be set", core_1.ErrorCode.ApiError);
                }
                if (jsi.config.max_deliver !== undefined && jsi.config.max_deliver > 1) {
                    throw new types_1.NatsError("ordered consumer: max_deliver cannot be set", core_1.ErrorCode.ApiError);
                }
                if (jsi.config.deliver_group && jsi.config.deliver_group.length > 0) {
                    throw new types_1.NatsError("ordered consumer: deliver_group cannot be set", core_1.ErrorCode.ApiError);
                }
                jsi.config.deliver_subject = (0, core_1.createInbox)(this.nc.options.inboxPrefix);
                jsi.config.ack_policy = jsapi_types_1.AckPolicy.None;
                jsi.config.max_deliver = 1;
                jsi.config.flow_control = true;
                jsi.config.idle_heartbeat = jsi.config.idle_heartbeat || (0, util_1.nanos)(5000);
                jsi.config.ack_wait = (0, util_1.nanos)(22 * 60 * 60 * 1000);
                jsi.config.mem_storage = true;
                jsi.config.num_replicas = 1;
            }
            if (jsi.config.ack_policy === jsapi_types_1.AckPolicy.NotSet) {
                jsi.config.ack_policy = jsapi_types_1.AckPolicy.All;
            }
            jsi.api = this;
            jsi.config = jsi.config || {};
            jsi.stream = jsi.stream ? jsi.stream : yield this.findStream(subject);
            jsi.attached = false;
            if (jsi.config.durable_name) {
                try {
                    const info = yield this.consumerAPI.info(jsi.stream, jsi.config.durable_name);
                    if (info) {
                        if (info.config.filter_subject && info.config.filter_subject !== subject) {
                            throw new Error("subject does not match consumer");
                        }
                        // check if server returned push_bound, but there's no qn
                        const qn = (_a = jsi.config.deliver_group) !== null && _a !== void 0 ? _a : "";
                        if (qn === "" && info.push_bound === true) {
                            throw new Error(`duplicate subscription`);
                        }
                        const rqn = (_b = info.config.deliver_group) !== null && _b !== void 0 ? _b : "";
                        if (qn !== rqn) {
                            if (rqn === "") {
                                throw new Error(`durable requires no queue group`);
                            }
                            else {
                                throw new Error(`durable requires queue group '${rqn}'`);
                            }
                        }
                        jsi.last = info;
                        jsi.config = info.config;
                        jsi.attached = true;
                        // if not a durable capture the name of the ephemeral so
                        // that consumerInfo from the sub will work
                        if (!jsi.config.durable_name) {
                            jsi.name = info.name;
                        }
                    }
                }
                catch (err) {
                    //consumer doesn't exist
                    if (err.code !== "404") {
                        throw err;
                    }
                }
            }
            if (!jsi.attached && jsi.config.filter_subject === undefined &&
                jsi.config.filter_subjects === undefined) {
                // if no filter specified, we set the subject as the filter
                jsi.config.filter_subject = subject;
            }
            jsi.deliver = jsi.config.deliver_subject ||
                (0, core_1.createInbox)(this.nc.options.inboxPrefix);
            return jsi;
        });
    }
    _buildTypedSubscriptionOpts(jsi) {
        const so = {};
        so.adapter = msgAdapter(jsi.callbackFn === undefined, this.timeout);
        so.ingestionFilterFn = JetStreamClientImpl.ingestionFn(jsi.ordered);
        so.protocolFilterFn = (jm, ingest = false) => {
            const jsmi = jm;
            if ((0, jsutil_1.isFlowControlMsg)(jsmi.msg)) {
                if (!ingest) {
                    jsmi.msg.respond();
                }
                return false;
            }
            return true;
        };
        if (!jsi.mack && jsi.config.ack_policy !== jsapi_types_1.AckPolicy.None) {
            so.dispatchedFn = autoAckJsMsg;
        }
        if (jsi.callbackFn) {
            so.callback = jsi.callbackFn;
        }
        so.max = jsi.max || 0;
        so.queue = jsi.queue;
        return so;
    }
    _maybeCreateConsumer(jsi) {
        return __awaiter(this, void 0, void 0, function* () {
            if (jsi.attached) {
                return;
            }
            if (jsi.isBind) {
                throw new Error(`unable to bind - durable consumer ${jsi.config.durable_name} doesn't exist in ${jsi.stream}`);
            }
            jsi.config = Object.assign({
                deliver_policy: jsapi_types_1.DeliverPolicy.All,
                ack_policy: jsapi_types_1.AckPolicy.Explicit,
                ack_wait: (0, util_1.nanos)(30 * 1000),
                replay_policy: jsapi_types_1.ReplayPolicy.Instant,
            }, jsi.config);
            const ci = yield this.consumerAPI.add(jsi.stream, jsi.config);
            if (Array.isArray(jsi.config.filter_subjects && !Array.isArray(ci.config.filter_subjects))) {
                // server didn't honor `filter_subjects`
                throw new Error(`jetstream server doesn't support consumers with multiple filter subjects`);
            }
            jsi.name = ci.name;
            jsi.config = ci.config;
            jsi.last = ci;
        });
    }
    static ingestionFn(ordered) {
        return (jm, ctx) => {
            var _a;
            // ctx is expected to be the iterator (the JetstreamSubscriptionImpl)
            const jsub = ctx;
            // this shouldn't happen
            if (!jm)
                return { ingest: false, protocol: false };
            const jmi = jm;
            if (!(0, jsutil_1.checkJsError)(jmi.msg)) {
                (_a = jsub.monitor) === null || _a === void 0 ? void 0 : _a.work();
            }
            if ((0, jsutil_1.isHeartbeatMsg)(jmi.msg)) {
                const ingest = ordered ? jsub._checkHbOrderConsumer(jmi.msg) : true;
                if (!ordered) {
                    jsub.info.flow_control.heartbeat_count++;
                }
                return { ingest, protocol: true };
            }
            else if ((0, jsutil_1.isFlowControlMsg)(jmi.msg)) {
                jsub.info.flow_control.fc_count++;
                return { ingest: true, protocol: true };
            }
            const ingest = ordered ? jsub._checkOrderedConsumer(jm) : true;
            return { ingest, protocol: false };
        };
    }
}
exports.JetStreamClientImpl = JetStreamClientImpl;
class JetStreamSubscriptionImpl extends typedsub_1.TypedSubscription {
    constructor(js, subject, opts) {
        super(js.nc, subject, opts);
        this.js = js;
        this.monitor = null;
        this.sub.closed.then(() => {
            if (this.monitor) {
                this.monitor.cancel();
            }
        });
    }
    set info(info) {
        this.sub.info = info;
    }
    get info() {
        return this.sub.info;
    }
    _resetOrderedConsumer(sseq) {
        if (this.info === null || this.sub.isClosed()) {
            return;
        }
        const newDeliver = (0, core_1.createInbox)(this.js.nc.options.inboxPrefix);
        const nci = this.js.nc;
        nci._resub(this.sub, newDeliver);
        const info = this.info;
        info.config.name = nuid_1.nuid.next();
        info.ordered_consumer_sequence.delivery_seq = 0;
        info.flow_control.heartbeat_count = 0;
        info.flow_control.fc_count = 0;
        info.flow_control.consumer_restarts++;
        info.deliver = newDeliver;
        info.config.deliver_subject = newDeliver;
        info.config.deliver_policy = jsapi_types_1.DeliverPolicy.StartSequence;
        info.config.opt_start_seq = sseq;
        // put the stream name
        const req = {};
        req.stream_name = this.info.stream;
        req.config = info.config;
        const subj = `${info.api.prefix}.CONSUMER.CREATE.${info.stream}`;
        this.js._request(subj, req, { retries: -1 })
            .then((v) => {
            const ci = v;
            const jinfo = this.sub.info;
            jinfo.last = ci;
            this.info.config = ci.config;
            this.info.name = ci.name;
        })
            .catch((err) => {
            // to inform the subscription we inject an error this will
            // be at after the last message if using an iterator.
            const nerr = new types_1.NatsError(`unable to recreate ordered consumer ${info.stream} at seq ${sseq}`, core_1.ErrorCode.RequestError, err);
            this.sub.callback(nerr, {});
        });
    }
    // this is called by push subscriptions, to initialize the monitoring
    // if configured on the consumer
    _maybeSetupHbMonitoring() {
        var _a, _b;
        const ns = ((_b = (_a = this.info) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.idle_heartbeat) || 0;
        if (ns) {
            this._setupHbMonitoring((0, util_1.millis)(ns));
        }
    }
    _setupHbMonitoring(millis, cancelAfter = 0) {
        const opts = { cancelAfter: 0, maxOut: 2 };
        if (cancelAfter) {
            opts.cancelAfter = cancelAfter;
        }
        const sub = this.sub;
        const handler = (v) => {
            var _a, _b, _c, _d;
            const msg = (0, jsutil_1.newJsErrorMsg)(409, `${jsutil_1.Js409Errors.IdleHeartbeatMissed}: ${v}`, this.sub.subject);
            const ordered = (_a = this.info) === null || _a === void 0 ? void 0 : _a.ordered;
            // non-ordered consumers are always notified of the condition
            // as they need to try and recover
            if (!ordered) {
                this.sub.callback(null, msg);
            }
            else {
                if (!this.js.nc.protocol.connected) {
                    // we are not connected don't do anything
                    return false;
                }
                // reset the consumer
                const seq = ((_c = (_b = this.info) === null || _b === void 0 ? void 0 : _b.ordered_consumer_sequence) === null || _c === void 0 ? void 0 : _c.stream_seq) || 0;
                this._resetOrderedConsumer(seq + 1);
                (_d = this.monitor) === null || _d === void 0 ? void 0 : _d.restart();
                // if we are ordered, we will reset the consumer and keep
                // feeding the iterator or callback - we are not stopping
                return false;
            }
            // let the hb monitor know if we are stopping for callbacks
            // we don't as we deliver the errors via the cb.
            return !sub.noIterator;
        };
        // this only applies for push subscriptions
        this.monitor = new idleheartbeat_monitor_1.IdleHeartbeatMonitor(millis, handler, opts);
    }
    _checkHbOrderConsumer(msg) {
        const rm = msg.headers.get(types_2.JsHeaders.ConsumerStalledHdr);
        if (rm !== "") {
            const nci = this.js.nc;
            nci.publish(rm);
        }
        const lastDelivered = parseInt(msg.headers.get(types_2.JsHeaders.LastConsumerSeqHdr), 10);
        const ordered = this.info.ordered_consumer_sequence;
        this.info.flow_control.heartbeat_count++;
        if (lastDelivered !== ordered.delivery_seq) {
            this._resetOrderedConsumer(ordered.stream_seq + 1);
        }
        return false;
    }
    _checkOrderedConsumer(jm) {
        const ordered = this.info.ordered_consumer_sequence;
        const sseq = jm.info.streamSequence;
        const dseq = jm.info.deliverySequence;
        if (dseq != ordered.delivery_seq + 1) {
            this._resetOrderedConsumer(ordered.stream_seq + 1);
            return false;
        }
        ordered.delivery_seq = dseq;
        ordered.stream_seq = sseq;
        return true;
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isClosed()) {
                yield this.drain();
            }
            const jinfo = this.sub.info;
            const name = jinfo.config.durable_name || jinfo.name;
            const subj = `${jinfo.api.prefix}.CONSUMER.DELETE.${jinfo.stream}.${name}`;
            yield jinfo.api._request(subj);
        });
    }
    consumerInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const jinfo = this.sub.info;
            const name = jinfo.config.durable_name || jinfo.name;
            const subj = `${jinfo.api.prefix}.CONSUMER.INFO.${jinfo.stream}.${name}`;
            const ci = yield jinfo.api._request(subj);
            jinfo.last = ci;
            return ci;
        });
    }
}
exports.JetStreamSubscriptionImpl = JetStreamSubscriptionImpl;
class JetStreamPullSubscriptionImpl extends JetStreamSubscriptionImpl {
    constructor(js, subject, opts) {
        super(js, subject, opts);
    }
    pull(opts = { batch: 1 }) {
        var _a, _b;
        const { stream, config, name } = this.sub.info;
        const consumer = (_a = config.durable_name) !== null && _a !== void 0 ? _a : name;
        const args = {};
        args.batch = opts.batch || 1;
        args.no_wait = opts.no_wait || false;
        if (((_b = opts.max_bytes) !== null && _b !== void 0 ? _b : 0) > 0) {
            const fv = this.js.nc.features.get(semver_1.Feature.JS_PULL_MAX_BYTES);
            if (!fv.ok) {
                throw new Error(`max_bytes is only supported on servers ${fv.min} or better`);
            }
            args.max_bytes = opts.max_bytes;
        }
        let expires = 0;
        if (opts.expires && opts.expires > 0) {
            expires = opts.expires;
            args.expires = (0, util_1.nanos)(expires);
        }
        let hb = 0;
        if (opts.idle_heartbeat && opts.idle_heartbeat > 0) {
            hb = opts.idle_heartbeat;
            args.idle_heartbeat = (0, util_1.nanos)(hb);
        }
        if (hb && expires === 0) {
            throw new Error("idle_heartbeat requires expires");
        }
        if (hb > expires) {
            throw new Error("expires must be greater than idle_heartbeat");
        }
        if (this.info) {
            if (this.monitor) {
                this.monitor.cancel();
            }
            if (expires && hb) {
                if (!this.monitor) {
                    this._setupHbMonitoring(hb, expires);
                }
                else {
                    this.monitor._change(hb, expires);
                }
            }
            const api = this.info.api;
            const subj = `${api.prefix}.CONSUMER.MSG.NEXT.${stream}.${consumer}`;
            const reply = this.sub.subject;
            api.nc.publish(subj, api.jc.encode(args), { reply: reply });
        }
    }
}
function msgAdapter(iterator, ackTimeout) {
    if (iterator) {
        return iterMsgAdapter(ackTimeout);
    }
    else {
        return cbMsgAdapter(ackTimeout);
    }
}
function cbMsgAdapter(ackTimeout) {
    return (err, msg) => {
        if (err) {
            return [err, null];
        }
        err = (0, jsutil_1.checkJsError)(msg);
        if (err) {
            return [err, null];
        }
        // assuming that the protocolFilterFn is set!
        return [null, (0, jsmsg_1.toJsMsg)(msg, ackTimeout)];
    };
}
function iterMsgAdapter(ackTimeout) {
    return (err, msg) => {
        if (err) {
            return [err, null];
        }
        // iterator will close if we have an error
        // check for errors that shouldn't close it
        const ne = (0, jsutil_1.checkJsError)(msg);
        if (ne !== null) {
            return [hideNonTerminalJsErrors(ne), null];
        }
        // assuming that the protocolFilterFn is set
        return [null, (0, jsmsg_1.toJsMsg)(msg, ackTimeout)];
    };
}
function hideNonTerminalJsErrors(ne) {
    if (ne !== null) {
        switch (ne.code) {
            case core_1.ErrorCode.JetStream404NoMessages:
            case core_1.ErrorCode.JetStream408RequestTimeout:
                return null;
            case core_1.ErrorCode.JetStream409:
                if ((0, jsutil_1.isTerminal409)(ne)) {
                    return ne;
                }
                return null;
            default:
                return ne;
        }
    }
    return null;
}
function autoAckJsMsg(data) {
    if (data) {
        data.ack();
    }
}
//# sourceMappingURL=jsclient.js.map