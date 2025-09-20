import { Msg, NatsError } from "../nats-base-client/core";
export declare function validateDurableName(name?: string): string;
export declare function validateStreamName(name?: string): string;
export declare function minValidation(context: string, name?: string): string;
export declare function validateName(context: string, name?: string): void;
export declare function validName(name?: string): string;
/**
 * Returns true if the message is a flow control message
 * @param msg
 */
export declare function isFlowControlMsg(msg: Msg): boolean;
/**
 * Returns true if the message is a heart beat message
 * @param msg
 */
export declare function isHeartbeatMsg(msg: Msg): boolean;
export declare function newJsErrorMsg(code: number, description: string, subject: string): Msg;
export declare function checkJsError(msg: Msg): NatsError | null;
export declare enum Js409Errors {
    MaxBatchExceeded = "exceeded maxrequestbatch of",
    MaxExpiresExceeded = "exceeded maxrequestexpires of",
    MaxBytesExceeded = "exceeded maxrequestmaxbytes of",
    MaxMessageSizeExceeded = "message size exceeds maxbytes",
    PushConsumer = "consumer is push based",
    MaxWaitingExceeded = "exceeded maxwaiting",// not terminal
    IdleHeartbeatMissed = "idle heartbeats missed",
    ConsumerDeleted = "consumer deleted"
}
export declare function setMaxWaitingToFail(tf: boolean): void;
export declare function isTerminal409(err: NatsError): boolean;
export declare function checkJsErrorCode(code: number, description?: string): NatsError | null;
