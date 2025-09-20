"use strict";
/*
 * Copyright 2023-2024 The NATS Authors
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerOptsBuilderImpl = exports.kvPrefix = exports.RepublishHeaders = exports.DirectMsgHeaders = exports.KvWatchInclude = exports.JsHeaders = exports.AdvisoryKind = void 0;
exports.consumerOpts = consumerOpts;
exports.isConsumerOptsBuilder = isConsumerOptsBuilder;
const jsapi_types_1 = require("./jsapi_types");
const jsutil_1 = require("./jsutil");
const util_1 = require("../nats-base-client/util");
/**
 * The different kinds of Advisories
 */
var AdvisoryKind;
(function (AdvisoryKind) {
    AdvisoryKind["API"] = "api_audit";
    AdvisoryKind["StreamAction"] = "stream_action";
    AdvisoryKind["ConsumerAction"] = "consumer_action";
    AdvisoryKind["SnapshotCreate"] = "snapshot_create";
    AdvisoryKind["SnapshotComplete"] = "snapshot_complete";
    AdvisoryKind["RestoreCreate"] = "restore_create";
    AdvisoryKind["RestoreComplete"] = "restore_complete";
    AdvisoryKind["MaxDeliver"] = "max_deliver";
    AdvisoryKind["Terminated"] = "terminated";
    AdvisoryKind["Ack"] = "consumer_ack";
    AdvisoryKind["StreamLeaderElected"] = "stream_leader_elected";
    AdvisoryKind["StreamQuorumLost"] = "stream_quorum_lost";
    AdvisoryKind["ConsumerLeaderElected"] = "consumer_leader_elected";
    AdvisoryKind["ConsumerQuorumLost"] = "consumer_quorum_lost";
})(AdvisoryKind || (exports.AdvisoryKind = AdvisoryKind = {}));
var JsHeaders;
(function (JsHeaders) {
    /**
     * Set if message is from a stream source - format is `stream seq`
     */
    JsHeaders["StreamSourceHdr"] = "Nats-Stream-Source";
    /**
     * Set for heartbeat messages
     */
    JsHeaders["LastConsumerSeqHdr"] = "Nats-Last-Consumer";
    /**
     * Set for heartbeat messages
     */
    JsHeaders["LastStreamSeqHdr"] = "Nats-Last-Stream";
    /**
     * Set for heartbeat messages if the consumer is stalled
     */
    JsHeaders["ConsumerStalledHdr"] = "Nats-Consumer-Stalled";
    /**
     * Set for headers_only consumers indicates the number of bytes in the payload
     */
    JsHeaders["MessageSizeHdr"] = "Nats-Msg-Size";
    // rollup header
    JsHeaders["RollupHdr"] = "Nats-Rollup";
    // value for rollup header when rolling up a subject
    JsHeaders["RollupValueSubject"] = "sub";
    // value for rollup header when rolling up all subjects
    JsHeaders["RollupValueAll"] = "all";
    /**
     * Set on protocol messages to indicate pull request message count that
     * was not honored.
     */
    JsHeaders["PendingMessagesHdr"] = "Nats-Pending-Messages";
    /**
     * Set on protocol messages to indicate pull request byte count that
     * was not honored
     */
    JsHeaders["PendingBytesHdr"] = "Nats-Pending-Bytes";
})(JsHeaders || (exports.JsHeaders = JsHeaders = {}));
var KvWatchInclude;
(function (KvWatchInclude) {
    /**
     * Include the last value for all the keys
     */
    KvWatchInclude["LastValue"] = "";
    /**
     * Include all available history for all keys
     */
    KvWatchInclude["AllHistory"] = "history";
    /**
     * Don't include history or last values, only notify
     * of updates
     */
    KvWatchInclude["UpdatesOnly"] = "updates";
})(KvWatchInclude || (exports.KvWatchInclude = KvWatchInclude = {}));
var DirectMsgHeaders;
(function (DirectMsgHeaders) {
    DirectMsgHeaders["Stream"] = "Nats-Stream";
    DirectMsgHeaders["Sequence"] = "Nats-Sequence";
    DirectMsgHeaders["TimeStamp"] = "Nats-Time-Stamp";
    DirectMsgHeaders["Subject"] = "Nats-Subject";
})(DirectMsgHeaders || (exports.DirectMsgHeaders = DirectMsgHeaders = {}));
var RepublishHeaders;
(function (RepublishHeaders) {
    /**
     * The source stream of the message
     */
    RepublishHeaders["Stream"] = "Nats-Stream";
    /**
     * The original subject of the message
     */
    RepublishHeaders["Subject"] = "Nats-Subject";
    /**
     * The sequence of the republished message
     */
    RepublishHeaders["Sequence"] = "Nats-Sequence";
    /**
     * The stream sequence id of the last message ingested to the same original subject (or 0 if none or deleted)
     */
    RepublishHeaders["LastSequence"] = "Nats-Last-Sequence";
    /**
     * The size in bytes of the message's body - Only if {@link Republish#headers_only} is set.
     */
    RepublishHeaders["Size"] = "Nats-Msg-Size";
})(RepublishHeaders || (exports.RepublishHeaders = RepublishHeaders = {}));
exports.kvPrefix = "KV_";
// FIXME: some items here that may need to be addressed
// 503s?
// maxRetries()
// retryBackoff()
// ackWait(time)
// replayOriginal()
// rateLimit(bytesPerSec)
class ConsumerOptsBuilderImpl {
    constructor(opts) {
        this.stream = "";
        this.mack = false;
        this.ordered = false;
        this.config = (0, jsapi_types_1.defaultConsumer)("", opts || {});
    }
    getOpts() {
        var _a;
        const o = {};
        o.config = Object.assign({}, this.config);
        if (o.config.filter_subject) {
            this.filterSubject(o.config.filter_subject);
            o.config.filter_subject = undefined;
        }
        if (o.config.filter_subjects) {
            (_a = o.config.filter_subjects) === null || _a === void 0 ? void 0 : _a.forEach((v) => {
                this.filterSubject(v);
            });
            o.config.filter_subjects = undefined;
        }
        o.mack = this.mack;
        o.stream = this.stream;
        o.callbackFn = this.callbackFn;
        o.max = this.max;
        o.queue = this.qname;
        o.ordered = this.ordered;
        o.config.ack_policy = o.ordered ? jsapi_types_1.AckPolicy.None : o.config.ack_policy;
        o.isBind = o.isBind || false;
        if (this.filters) {
            switch (this.filters.length) {
                case 0:
                    break;
                case 1:
                    o.config.filter_subject = this.filters[0];
                    break;
                default:
                    o.config.filter_subjects = this.filters;
            }
        }
        return o;
    }
    description(description) {
        this.config.description = description;
        return this;
    }
    deliverTo(subject) {
        this.config.deliver_subject = subject;
        return this;
    }
    durable(name) {
        (0, jsutil_1.validateDurableName)(name);
        this.config.durable_name = name;
        return this;
    }
    startSequence(seq) {
        if (seq <= 0) {
            throw new Error("sequence must be greater than 0");
        }
        this.config.deliver_policy = jsapi_types_1.DeliverPolicy.StartSequence;
        this.config.opt_start_seq = seq;
        return this;
    }
    startTime(time) {
        this.config.deliver_policy = jsapi_types_1.DeliverPolicy.StartTime;
        this.config.opt_start_time = time.toISOString();
        return this;
    }
    deliverAll() {
        this.config.deliver_policy = jsapi_types_1.DeliverPolicy.All;
        return this;
    }
    deliverLastPerSubject() {
        this.config.deliver_policy = jsapi_types_1.DeliverPolicy.LastPerSubject;
        return this;
    }
    deliverLast() {
        this.config.deliver_policy = jsapi_types_1.DeliverPolicy.Last;
        return this;
    }
    deliverNew() {
        this.config.deliver_policy = jsapi_types_1.DeliverPolicy.New;
        return this;
    }
    startAtTimeDelta(millis) {
        this.startTime(new Date(Date.now() - millis));
        return this;
    }
    headersOnly() {
        this.config.headers_only = true;
        return this;
    }
    ackNone() {
        this.config.ack_policy = jsapi_types_1.AckPolicy.None;
        return this;
    }
    ackAll() {
        this.config.ack_policy = jsapi_types_1.AckPolicy.All;
        return this;
    }
    ackExplicit() {
        this.config.ack_policy = jsapi_types_1.AckPolicy.Explicit;
        return this;
    }
    ackWait(millis) {
        this.config.ack_wait = (0, util_1.nanos)(millis);
        return this;
    }
    maxDeliver(max) {
        this.config.max_deliver = max;
        return this;
    }
    filterSubject(s) {
        this.filters = this.filters || [];
        this.filters.push(s);
        return this;
    }
    replayInstantly() {
        this.config.replay_policy = jsapi_types_1.ReplayPolicy.Instant;
        return this;
    }
    replayOriginal() {
        this.config.replay_policy = jsapi_types_1.ReplayPolicy.Original;
        return this;
    }
    sample(n) {
        n = Math.trunc(n);
        if (n < 0 || n > 100) {
            throw new Error(`value must be between 0-100`);
        }
        this.config.sample_freq = `${n}%`;
        return this;
    }
    limit(n) {
        this.config.rate_limit_bps = n;
        return this;
    }
    maxWaiting(max) {
        this.config.max_waiting = max;
        return this;
    }
    maxAckPending(max) {
        this.config.max_ack_pending = max;
        return this;
    }
    idleHeartbeat(millis) {
        this.config.idle_heartbeat = (0, util_1.nanos)(millis);
        return this;
    }
    flowControl() {
        this.config.flow_control = true;
        return this;
    }
    deliverGroup(name) {
        this.queue(name);
        return this;
    }
    manualAck() {
        this.mack = true;
        return this;
    }
    maxMessages(max) {
        this.max = max;
        return this;
    }
    callback(fn) {
        this.callbackFn = fn;
        return this;
    }
    queue(n) {
        this.qname = n;
        this.config.deliver_group = n;
        return this;
    }
    orderedConsumer() {
        this.ordered = true;
        return this;
    }
    bind(stream, durable) {
        this.stream = stream;
        this.config.durable_name = durable;
        this.isBind = true;
        return this;
    }
    bindStream(stream) {
        this.stream = stream;
        return this;
    }
    inactiveEphemeralThreshold(millis) {
        this.config.inactive_threshold = (0, util_1.nanos)(millis);
        return this;
    }
    maxPullBatch(n) {
        this.config.max_batch = n;
        return this;
    }
    maxPullRequestExpires(millis) {
        this.config.max_expires = (0, util_1.nanos)(millis);
        return this;
    }
    memory() {
        this.config.mem_storage = true;
        return this;
    }
    numReplicas(n) {
        this.config.num_replicas = n;
        return this;
    }
    consumerName(n) {
        this.config.name = n;
        return this;
    }
}
exports.ConsumerOptsBuilderImpl = ConsumerOptsBuilderImpl;
function consumerOpts(opts) {
    return new ConsumerOptsBuilderImpl(opts);
}
function isConsumerOptsBuilder(o) {
    return typeof o.getOpts === "function";
}
//# sourceMappingURL=types.js.map