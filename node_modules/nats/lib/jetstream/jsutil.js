"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Js409Errors = void 0;
exports.validateDurableName = validateDurableName;
exports.validateStreamName = validateStreamName;
exports.minValidation = minValidation;
exports.validateName = validateName;
exports.validName = validName;
exports.isFlowControlMsg = isFlowControlMsg;
exports.isHeartbeatMsg = isHeartbeatMsg;
exports.newJsErrorMsg = newJsErrorMsg;
exports.checkJsError = checkJsError;
exports.setMaxWaitingToFail = setMaxWaitingToFail;
exports.isTerminal409 = isTerminal409;
exports.checkJsErrorCode = checkJsErrorCode;
/*
 * Copyright 2021-2024 The NATS Authors
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
const encoders_1 = require("../nats-base-client/encoders");
const headers_1 = require("../nats-base-client/headers");
const msg_1 = require("../nats-base-client/msg");
const core_1 = require("../nats-base-client/core");
function validateDurableName(name) {
    return minValidation("durable", name);
}
function validateStreamName(name) {
    return minValidation("stream", name);
}
function minValidation(context, name = "") {
    // minimum validation on streams/consumers matches nats cli
    if (name === "") {
        throw Error(`${context} name required`);
    }
    const bad = [".", "*", ">", "/", "\\", " ", "\t", "\n", "\r"];
    bad.forEach((v) => {
        if (name.indexOf(v) !== -1) {
            // make the error have a meaningful character
            switch (v) {
                case "\n":
                    v = "\\n";
                    break;
                case "\r":
                    v = "\\r";
                    break;
                case "\t":
                    v = "\\t";
                    break;
                default:
                // nothing
            }
            throw Error(`invalid ${context} name - ${context} name cannot contain '${v}'`);
        }
    });
    return "";
}
function validateName(context, name = "") {
    if (name === "") {
        throw Error(`${context} name required`);
    }
    const m = validName(name);
    if (m.length) {
        throw new Error(`invalid ${context} name - ${context} name ${m}`);
    }
}
function validName(name = "") {
    if (name === "") {
        throw Error(`name required`);
    }
    const RE = /^[-\w]+$/g;
    const m = name.match(RE);
    if (m === null) {
        for (const c of name.split("")) {
            const mm = c.match(RE);
            if (mm === null) {
                return `cannot contain '${c}'`;
            }
        }
    }
    return "";
}
/**
 * Returns true if the message is a flow control message
 * @param msg
 */
function isFlowControlMsg(msg) {
    if (msg.data.length > 0) {
        return false;
    }
    const h = msg.headers;
    if (!h) {
        return false;
    }
    return h.code >= 100 && h.code < 200;
}
/**
 * Returns true if the message is a heart beat message
 * @param msg
 */
function isHeartbeatMsg(msg) {
    var _a;
    return isFlowControlMsg(msg) && ((_a = msg.headers) === null || _a === void 0 ? void 0 : _a.description) === "Idle Heartbeat";
}
function newJsErrorMsg(code, description, subject) {
    const h = (0, headers_1.headers)(code, description);
    const arg = { hdr: 1, sid: 0, size: 0 };
    const msg = new msg_1.MsgImpl(arg, encoders_1.Empty, {});
    msg._headers = h;
    msg._subject = subject;
    return msg;
}
function checkJsError(msg) {
    // JS error only if no payload - otherwise assume it is application data
    if (msg.data.length !== 0) {
        return null;
    }
    const h = msg.headers;
    if (!h) {
        return null;
    }
    return checkJsErrorCode(h.code, h.description);
}
var Js409Errors;
(function (Js409Errors) {
    Js409Errors["MaxBatchExceeded"] = "exceeded maxrequestbatch of";
    Js409Errors["MaxExpiresExceeded"] = "exceeded maxrequestexpires of";
    Js409Errors["MaxBytesExceeded"] = "exceeded maxrequestmaxbytes of";
    Js409Errors["MaxMessageSizeExceeded"] = "message size exceeds maxbytes";
    Js409Errors["PushConsumer"] = "consumer is push based";
    Js409Errors["MaxWaitingExceeded"] = "exceeded maxwaiting";
    Js409Errors["IdleHeartbeatMissed"] = "idle heartbeats missed";
    Js409Errors["ConsumerDeleted"] = "consumer deleted";
    // FIXME: consumer deleted - instead of no responder (terminal error)
    //   leadership changed -
})(Js409Errors || (exports.Js409Errors = Js409Errors = {}));
let MAX_WAITING_FAIL = false;
function setMaxWaitingToFail(tf) {
    MAX_WAITING_FAIL = tf;
}
function isTerminal409(err) {
    if (err.code !== core_1.ErrorCode.JetStream409) {
        return false;
    }
    const fatal = [
        Js409Errors.MaxBatchExceeded,
        Js409Errors.MaxExpiresExceeded,
        Js409Errors.MaxBytesExceeded,
        Js409Errors.MaxMessageSizeExceeded,
        Js409Errors.PushConsumer,
        Js409Errors.IdleHeartbeatMissed,
        Js409Errors.ConsumerDeleted,
    ];
    if (MAX_WAITING_FAIL) {
        fatal.push(Js409Errors.MaxWaitingExceeded);
    }
    return fatal.find((s) => {
        return err.message.indexOf(s) !== -1;
    }) !== undefined;
}
function checkJsErrorCode(code, description = "") {
    if (code < 300) {
        return null;
    }
    description = description.toLowerCase();
    switch (code) {
        case 404:
            // 404 for jetstream will provide different messages ensure we
            // keep whatever the server returned
            return new core_1.NatsError(description, core_1.ErrorCode.JetStream404NoMessages);
        case 408:
            return new core_1.NatsError(description, core_1.ErrorCode.JetStream408RequestTimeout);
        case 409: {
            // the description can be exceeded max waiting or max ack pending, which are
            // recoverable, but can also be terminal errors where the request exceeds
            // some value in the consumer configuration
            const ec = description.startsWith(Js409Errors.IdleHeartbeatMissed)
                ? core_1.ErrorCode.JetStreamIdleHeartBeat
                : core_1.ErrorCode.JetStream409;
            return new core_1.NatsError(description, ec);
        }
        case 503:
            return core_1.NatsError.errorForCode(core_1.ErrorCode.JetStreamNotEnabled, new Error(description));
        default:
            if (description === "") {
                description = core_1.ErrorCode.Unknown;
            }
            return new core_1.NatsError(description, `${code}`);
    }
}
//# sourceMappingURL=jsutil.js.map