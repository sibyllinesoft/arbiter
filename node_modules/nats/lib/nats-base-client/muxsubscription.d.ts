import { Msg, NatsError, Request } from "./core";
export declare class MuxSubscription {
    baseInbox: string;
    reqs: Map<string, Request>;
    constructor();
    size(): number;
    init(prefix?: string): string;
    add(r: Request): void;
    get(token: string): Request | undefined;
    cancel(r: Request): void;
    getToken(m: Msg): string | null;
    all(): Request[];
    handleError(isMuxPermissionError: boolean, err?: NatsError): boolean;
    dispatcher(): (err: NatsError | null, m: Msg) => void;
    close(): void;
}
