"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = connect;
/*
 * Copyright 2020 The NATS Authors
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
const node_transport_1 = require("./node_transport");
const nats_base_client_1 = require("./nats-base-client");
function connect(opts = {}) {
    (0, nats_base_client_1.setTransportFactory)({
        factory: () => {
            return new node_transport_1.NodeTransport();
        },
        dnsResolveFn: node_transport_1.nodeResolveHost,
    });
    return nats_base_client_1.NatsConnectionImpl.connect(opts);
}
//# sourceMappingURL=connect.js.map