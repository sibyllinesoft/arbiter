"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @ignore
 */
//@ts-ignore
const nacl = require("tweetnacl");
/**
 * @ignore
 */
//@ts-ignore
const helper = {
    randomBytes: nacl.randomBytes,
    verify: nacl.sign.detached.verify,
    fromSeed: nacl.sign.keyPair.fromSeed,
    sign: nacl.sign.detached,
    scalarBaseMultiply: nacl.scalarMult.base,
    seal: nacl.box,
    open: nacl.box.open,
};
// This here to support node 10.
if (typeof TextEncoder === "undefined") {
    //@ts-ignore
    const util = require("util");
    //@ts-ignore
    global.TextEncoder = util.TextEncoder;
    //@ts-ignore
    global.TextDecoder = util.TextDecoder;
}
if (typeof atob === "undefined") {
    global.atob = (a) => {
        return Buffer.from(a, "base64").toString("binary");
    };
    global.btoa = (b) => {
        return Buffer.from(b, "binary").toString("base64");
    };
}
/**
 * @ignore
 */
//@ts-ignore
const { setEd25519Helper } = require("./helper");
setEd25519Helper(helper);
/**
 * @ignore
 */
//@ts-ignore
__exportStar(require("./mod"), exports);
