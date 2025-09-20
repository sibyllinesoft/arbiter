"use strict";
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
exports.Servers = exports.ServerImpl = void 0;
exports.isIPV4OrHostname = isIPV4OrHostname;
exports.hostPort = hostPort;
/*
 * Copyright 2018-2022 The NATS Authors
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
const transport_1 = require("./transport");
const util_1 = require("./util");
const ipparser_1 = require("./ipparser");
const core_1 = require("./core");
function isIPV4OrHostname(hp) {
    if (hp.indexOf("[") !== -1 || hp.indexOf("::") !== -1) {
        return false;
    }
    if (hp.indexOf(".") !== -1) {
        return true;
    }
    // if we have a plain hostname or host:port
    if (hp.split(":").length <= 2) {
        return true;
    }
    return false;
}
function isIPV6(hp) {
    return !isIPV4OrHostname(hp);
}
function filterIpv6MappedToIpv4(hp) {
    const prefix = "::FFFF:";
    const idx = hp.toUpperCase().indexOf(prefix);
    if (idx !== -1 && hp.indexOf(".") !== -1) {
        // we have something like: ::FFFF:127.0.0.1 or [::FFFF:127.0.0.1]:4222
        let ip = hp.substring(idx + prefix.length);
        ip = ip.replace("[", "");
        return ip.replace("]", "");
    }
    return hp;
}
function hostPort(u) {
    u = u.trim();
    // remove any protocol that may have been provided
    if (u.match(/^(.*:\/\/)(.*)/m)) {
        u = u.replace(/^(.*:\/\/)(.*)/gm, "$2");
    }
    // in web environments, URL may not be a living standard
    // that means that protocols other than HTTP/S are not
    // parsable correctly.
    // the third complication is that we may have been given
    // an IPv6 or worse IPv6 mapping an Ipv4
    u = filterIpv6MappedToIpv4(u);
    // we only wrap cases where they gave us a plain ipv6
    // and we are not already bracketed
    if (isIPV6(u) && u.indexOf("[") === -1) {
        u = `[${u}]`;
    }
    // if we have ipv6, we expect port after ']:' otherwise after ':'
    const op = isIPV6(u) ? u.match(/(]:)(\d+)/) : u.match(/(:)(\d+)/);
    const port = op && op.length === 3 && op[1] && op[2]
        ? parseInt(op[2])
        : core_1.DEFAULT_PORT;
    // the next complication is that new URL() may
    // eat ports which match the protocol - so for example
    // port 80 may be eliminated - so we flip the protocol
    // so that it always yields a value
    const protocol = port === 80 ? "https" : "http";
    const url = new URL(`${protocol}://${u}`);
    url.port = `${port}`;
    let hostname = url.hostname;
    // if we are bracketed, we need to rip it out
    if (hostname.charAt(0) === "[") {
        hostname = hostname.substring(1, hostname.length - 1);
    }
    const listen = url.host;
    return { listen, hostname, port };
}
/**
 * @hidden
 */
class ServerImpl {
    constructor(u, gossiped = false) {
        this.src = u;
        this.tlsName = "";
        const v = hostPort(u);
        this.listen = v.listen;
        this.hostname = v.hostname;
        this.port = v.port;
        this.didConnect = false;
        this.reconnects = 0;
        this.lastConnect = 0;
        this.gossiped = gossiped;
    }
    toString() {
        return this.listen;
    }
    resolve(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!opts.fn || opts.resolve === false) {
                // we cannot resolve - transport doesn't support it
                // or user opted out
                // don't add - to resolves or we get a circ reference
                return [this];
            }
            const buf = [];
            if ((0, ipparser_1.isIP)(this.hostname)) {
                // don't add - to resolves or we get a circ reference
                return [this];
            }
            else {
                // resolve the hostname to ips
                const ips = yield opts.fn(this.hostname);
                if (opts.debug) {
                    console.log(`resolve ${this.hostname} = ${ips.join(",")}`);
                }
                for (const ip of ips) {
                    // letting URL handle the details of representing IPV6 ip with a port, etc
                    // careful to make sure the protocol doesn't line with standard ports or they
                    // get swallowed
                    const proto = this.port === 80 ? "https" : "http";
                    // ipv6 won't be bracketed here, because it came from resolve
                    const url = new URL(`${proto}://${isIPV6(ip) ? "[" + ip + "]" : ip}`);
                    url.port = `${this.port}`;
                    const ss = new ServerImpl(url.host, false);
                    ss.tlsName = this.hostname;
                    buf.push(ss);
                }
            }
            if (opts.randomize) {
                (0, util_1.shuffle)(buf);
            }
            this.resolves = buf;
            return buf;
        });
    }
}
exports.ServerImpl = ServerImpl;
/**
 * @hidden
 */
class Servers {
    constructor(listens = [], opts = {}) {
        this.firstSelect = true;
        this.servers = [];
        this.tlsName = "";
        this.randomize = opts.randomize || false;
        const urlParseFn = (0, transport_1.getUrlParseFn)();
        if (listens) {
            listens.forEach((hp) => {
                hp = urlParseFn ? urlParseFn(hp) : hp;
                this.servers.push(new ServerImpl(hp));
            });
            if (this.randomize) {
                this.servers = (0, util_1.shuffle)(this.servers);
            }
        }
        if (this.servers.length === 0) {
            this.addServer(`${core_1.DEFAULT_HOST}:${(0, transport_1.defaultPort)()}`, false);
        }
        this.currentServer = this.servers[0];
    }
    clear() {
        this.servers.length = 0;
    }
    updateTLSName() {
        const cs = this.getCurrentServer();
        if (!(0, ipparser_1.isIP)(cs.hostname)) {
            this.tlsName = cs.hostname;
            this.servers.forEach((s) => {
                if (s.gossiped) {
                    s.tlsName = this.tlsName;
                }
            });
        }
    }
    getCurrentServer() {
        return this.currentServer;
    }
    addServer(u, implicit = false) {
        const urlParseFn = (0, transport_1.getUrlParseFn)();
        u = urlParseFn ? urlParseFn(u) : u;
        const s = new ServerImpl(u, implicit);
        if ((0, ipparser_1.isIP)(s.hostname)) {
            s.tlsName = this.tlsName;
        }
        this.servers.push(s);
    }
    selectServer() {
        // allow using select without breaking the order of the servers
        if (this.firstSelect) {
            this.firstSelect = false;
            return this.currentServer;
        }
        const t = this.servers.shift();
        if (t) {
            this.servers.push(t);
            this.currentServer = t;
        }
        return t;
    }
    removeCurrentServer() {
        this.removeServer(this.currentServer);
    }
    removeServer(server) {
        if (server) {
            const index = this.servers.indexOf(server);
            this.servers.splice(index, 1);
        }
    }
    length() {
        return this.servers.length;
    }
    next() {
        return this.servers.length ? this.servers[0] : undefined;
    }
    getServers() {
        return this.servers;
    }
    update(info, encrypted) {
        const added = [];
        let deleted = [];
        const urlParseFn = (0, transport_1.getUrlParseFn)();
        const discovered = new Map();
        if (info.connect_urls && info.connect_urls.length > 0) {
            info.connect_urls.forEach((hp) => {
                hp = urlParseFn ? urlParseFn(hp, encrypted) : hp;
                const s = new ServerImpl(hp, true);
                discovered.set(hp, s);
            });
        }
        // remove gossiped servers that are no longer reported
        const toDelete = [];
        this.servers.forEach((s, index) => {
            const u = s.listen;
            if (s.gossiped && this.currentServer.listen !== u &&
                discovered.get(u) === undefined) {
                // server was removed
                toDelete.push(index);
            }
            // remove this entry from reported
            discovered.delete(u);
        });
        // perform the deletion
        toDelete.reverse();
        toDelete.forEach((index) => {
            const removed = this.servers.splice(index, 1);
            deleted = deleted.concat(removed[0].listen);
        });
        // remaining servers are new
        discovered.forEach((v, k) => {
            this.servers.push(v);
            added.push(k);
        });
        return { added, deleted };
    }
}
exports.Servers = Servers;
//# sourceMappingURL=servers.js.map