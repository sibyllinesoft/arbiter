"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEd25519Helper = exports.setEd25519Helper = void 0;
/**
 * @ignore
 */
let helper;
/**
 * @ignore
 */
function setEd25519Helper(lib) {
    helper = lib;
}
exports.setEd25519Helper = setEd25519Helper;
/**
 * @ignore
 */
function getEd25519Helper() {
    return helper;
}
exports.getEd25519Helper = getEd25519Helper;
