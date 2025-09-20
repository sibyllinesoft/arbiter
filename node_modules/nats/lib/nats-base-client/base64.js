"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Base64UrlPaddedCodec = exports.Base64UrlCodec = exports.Base64Codec = void 0;
class Base64Codec {
    static encode(bytes) {
        if (typeof bytes === "string") {
            return btoa(bytes);
        }
        const a = Array.from(bytes);
        return btoa(String.fromCharCode(...a));
    }
    static decode(s, binary = false) {
        const bin = atob(s);
        if (!binary) {
            return bin;
        }
        return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    }
}
exports.Base64Codec = Base64Codec;
class Base64UrlCodec {
    static encode(bytes) {
        return Base64UrlCodec.toB64URLEncoding(Base64Codec.encode(bytes));
    }
    static decode(s, binary = false) {
        return Base64Codec.decode(Base64UrlCodec.fromB64URLEncoding(s), binary);
    }
    static toB64URLEncoding(b64str) {
        return b64str
            .replace(/=/g, "")
            .replace(/\+/g, "-")
            .replace(/\//g, "_");
    }
    static fromB64URLEncoding(b64str) {
        // pads are % 4, but not necessary on decoding
        return b64str
            .replace(/_/g, "/")
            .replace(/-/g, "+");
    }
}
exports.Base64UrlCodec = Base64UrlCodec;
class Base64UrlPaddedCodec {
    static encode(bytes) {
        return Base64UrlPaddedCodec.toB64URLEncoding(Base64Codec.encode(bytes));
    }
    static decode(s, binary = false) {
        return Base64UrlPaddedCodec.decode(Base64UrlPaddedCodec.fromB64URLEncoding(s), binary);
    }
    static toB64URLEncoding(b64str) {
        return b64str
            .replace(/\+/g, "-")
            .replace(/\//g, "_");
    }
    static fromB64URLEncoding(b64str) {
        // pads are % 4, but not necessary on decoding
        return b64str
            .replace(/_/g, "/")
            .replace(/-/g, "+");
    }
}
exports.Base64UrlPaddedCodec = Base64UrlPaddedCodec;
//# sourceMappingURL=base64.js.map