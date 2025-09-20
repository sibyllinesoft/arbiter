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
exports.ConsumerApiAction = exports.StoreCompression = exports.ReplayPolicy = exports.AckPolicy = exports.DeliverPolicy = exports.StorageType = exports.DiscardPolicy = exports.RetentionPolicy = void 0;
exports.defaultConsumer = defaultConsumer;
const util_1 = require("../nats-base-client/util");
var RetentionPolicy;
(function (RetentionPolicy) {
    /**
     * Retain messages until the limits are reached, then trigger the discard policy.
     */
    RetentionPolicy["Limits"] = "limits";
    /**
     * Retain messages while there is consumer interest on the particular subject.
     */
    RetentionPolicy["Interest"] = "interest";
    /**
     * Retain messages until acknowledged
     */
    RetentionPolicy["Workqueue"] = "workqueue";
})(RetentionPolicy || (exports.RetentionPolicy = RetentionPolicy = {}));
var DiscardPolicy;
(function (DiscardPolicy) {
    /**
     * Discard old messages to make room for the new ones
     */
    DiscardPolicy["Old"] = "old";
    /**
     * Discard the new messages
     */
    DiscardPolicy["New"] = "new";
})(DiscardPolicy || (exports.DiscardPolicy = DiscardPolicy = {}));
var StorageType;
(function (StorageType) {
    /**
     * Store persistently on files
     */
    StorageType["File"] = "file";
    /**
     * Store in server memory - doesn't survive server restarts
     */
    StorageType["Memory"] = "memory";
})(StorageType || (exports.StorageType = StorageType = {}));
var DeliverPolicy;
(function (DeliverPolicy) {
    /**
     * Deliver all messages
     */
    DeliverPolicy["All"] = "all";
    /**
     * Deliver starting with the last message
     */
    DeliverPolicy["Last"] = "last";
    /**
     * Deliver starting with new messages
     */
    DeliverPolicy["New"] = "new";
    /**
     * Deliver starting with the specified sequence
     */
    DeliverPolicy["StartSequence"] = "by_start_sequence";
    /**
     * Deliver starting with the specified time
     */
    DeliverPolicy["StartTime"] = "by_start_time";
    /**
     * Deliver starting with the last messages for every subject
     */
    DeliverPolicy["LastPerSubject"] = "last_per_subject";
})(DeliverPolicy || (exports.DeliverPolicy = DeliverPolicy = {}));
var AckPolicy;
(function (AckPolicy) {
    /**
     * Messages don't need to be Ack'ed.
     */
    AckPolicy["None"] = "none";
    /**
     * Ack, acknowledges all messages with a lower sequence
     */
    AckPolicy["All"] = "all";
    /**
     * All sequences must be explicitly acknowledged
     */
    AckPolicy["Explicit"] = "explicit";
    /**
     * @ignore
     */
    AckPolicy["NotSet"] = "";
})(AckPolicy || (exports.AckPolicy = AckPolicy = {}));
var ReplayPolicy;
(function (ReplayPolicy) {
    /**
     * Replays messages as fast as possible
     */
    ReplayPolicy["Instant"] = "instant";
    /**
     * Replays messages following the original delay between messages
     */
    ReplayPolicy["Original"] = "original";
})(ReplayPolicy || (exports.ReplayPolicy = ReplayPolicy = {}));
var StoreCompression;
(function (StoreCompression) {
    /**
     * No compression
     */
    StoreCompression["None"] = "none";
    /**
     * S2 compression
     */
    StoreCompression["S2"] = "s2";
})(StoreCompression || (exports.StoreCompression = StoreCompression = {}));
var ConsumerApiAction;
(function (ConsumerApiAction) {
    ConsumerApiAction["CreateOrUpdate"] = "";
    ConsumerApiAction["Update"] = "update";
    ConsumerApiAction["Create"] = "create";
})(ConsumerApiAction || (exports.ConsumerApiAction = ConsumerApiAction = {}));
function defaultConsumer(name, opts = {}) {
    return Object.assign({
        name: name,
        deliver_policy: DeliverPolicy.All,
        ack_policy: AckPolicy.Explicit,
        ack_wait: (0, util_1.nanos)(30 * 1000),
        replay_policy: ReplayPolicy.Instant,
    }, opts);
}
//# sourceMappingURL=jsapi_types.js.map