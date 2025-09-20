/**
 * Create and initialize a nuid.
 *
 * @api private
 */
export declare class Nuid {
    buf: Uint8Array;
    seq: number;
    inc: number;
    inited: boolean;
    constructor();
    /**
     * Initializes a nuid with a crypto random prefix,
     * and pseudo-random sequence and increment.
     *
     * @api private
     */
    private init;
    /**
     * Initializes the pseudo randmon sequence number and the increment range.
     *
     * @api private
     */
    private initSeqAndInc;
    /**
     * Sets the prefix from crypto random bytes. Converts to base36.
     *
     * @api private
     */
    private setPre;
    /**
     * Fills the sequence part of the nuid as base36 from this.seq.
     *
     * @api private
     */
    private fillSeq;
    /**
     * Returns the next nuid.
     *
     * @api private
     */
    next(): string;
    reset(): void;
}
export declare const nuid: Nuid;
