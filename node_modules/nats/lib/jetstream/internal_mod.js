"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerEvents = exports.ConsumerDebugEvents = exports.StoreCompression = exports.StorageType = exports.RetentionPolicy = exports.ReplayPolicy = exports.DiscardPolicy = exports.DeliverPolicy = exports.AckPolicy = exports.RepublishHeaders = exports.KvWatchInclude = exports.JsHeaders = exports.isConsumerOptsBuilder = exports.DirectMsgHeaders = exports.consumerOpts = exports.AdvisoryKind = exports.isHeartbeatMsg = exports.isFlowControlMsg = exports.checkJsError = void 0;
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
var jsutil_1 = require("./jsutil");
Object.defineProperty(exports, "checkJsError", { enumerable: true, get: function () { return jsutil_1.checkJsError; } });
Object.defineProperty(exports, "isFlowControlMsg", { enumerable: true, get: function () { return jsutil_1.isFlowControlMsg; } });
Object.defineProperty(exports, "isHeartbeatMsg", { enumerable: true, get: function () { return jsutil_1.isHeartbeatMsg; } });
var types_1 = require("./types");
Object.defineProperty(exports, "AdvisoryKind", { enumerable: true, get: function () { return types_1.AdvisoryKind; } });
Object.defineProperty(exports, "consumerOpts", { enumerable: true, get: function () { return types_1.consumerOpts; } });
Object.defineProperty(exports, "DirectMsgHeaders", { enumerable: true, get: function () { return types_1.DirectMsgHeaders; } });
Object.defineProperty(exports, "isConsumerOptsBuilder", { enumerable: true, get: function () { return types_1.isConsumerOptsBuilder; } });
Object.defineProperty(exports, "JsHeaders", { enumerable: true, get: function () { return types_1.JsHeaders; } });
Object.defineProperty(exports, "KvWatchInclude", { enumerable: true, get: function () { return types_1.KvWatchInclude; } });
Object.defineProperty(exports, "RepublishHeaders", { enumerable: true, get: function () { return types_1.RepublishHeaders; } });
var jsapi_types_1 = require("./jsapi_types");
Object.defineProperty(exports, "AckPolicy", { enumerable: true, get: function () { return jsapi_types_1.AckPolicy; } });
Object.defineProperty(exports, "DeliverPolicy", { enumerable: true, get: function () { return jsapi_types_1.DeliverPolicy; } });
Object.defineProperty(exports, "DiscardPolicy", { enumerable: true, get: function () { return jsapi_types_1.DiscardPolicy; } });
Object.defineProperty(exports, "ReplayPolicy", { enumerable: true, get: function () { return jsapi_types_1.ReplayPolicy; } });
Object.defineProperty(exports, "RetentionPolicy", { enumerable: true, get: function () { return jsapi_types_1.RetentionPolicy; } });
Object.defineProperty(exports, "StorageType", { enumerable: true, get: function () { return jsapi_types_1.StorageType; } });
Object.defineProperty(exports, "StoreCompression", { enumerable: true, get: function () { return jsapi_types_1.StoreCompression; } });
var consumer_1 = require("./consumer");
Object.defineProperty(exports, "ConsumerDebugEvents", { enumerable: true, get: function () { return consumer_1.ConsumerDebugEvents; } });
Object.defineProperty(exports, "ConsumerEvents", { enumerable: true, get: function () { return consumer_1.ConsumerEvents; } });
//# sourceMappingURL=internal_mod.js.map