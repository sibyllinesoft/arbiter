"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Heartbeat = void 0;
/*
 * Copyright 2020-2021 The NATS Authors
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
class Heartbeat {
    constructor(ph, interval, maxOut) {
        this.ph = ph;
        this.interval = interval;
        this.maxOut = maxOut;
        this.pendings = [];
    }
    // api to start the heartbeats, since this can be
    // spuriously called from dial, ensure we don't
    // leak timers
    start() {
        this.cancel();
        this._schedule();
    }
    // api for canceling the heartbeats, if stale is
    // true it will initiate a client disconnect
    cancel(stale) {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this._reset();
        if (stale) {
            this.ph.disconnect();
        }
    }
    _schedule() {
        // @ts-ignore: node is not a number - we treat this opaquely
        this.timer = setTimeout(() => {
            this.ph.dispatchStatus({ type: core_1.DebugEvents.PingTimer, data: `${this.pendings.length + 1}` });
            if (this.pendings.length === this.maxOut) {
                this.cancel(true);
                return;
            }
            const ping = (0, util_1.deferred)();
            this.ph.flush(ping)
                .then(() => {
                this._reset();
            })
                .catch(() => {
                // we disconnected - pongs were rejected
                this.cancel();
            });
            this.pendings.push(ping);
            this._schedule();
        }, this.interval);
    }
    _reset() {
        // clear pendings after resolving them
        this.pendings = this.pendings.filter((p) => {
            const d = p;
            d.resolve();
            return false;
        });
    }
}
exports.Heartbeat = Heartbeat;
//# sourceMappingURL=heartbeats.js.map