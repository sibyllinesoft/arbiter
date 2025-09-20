/**
 * @ignore
 */
export declare class crc16 {
    static checksum(data: Uint8Array): number;
    static validate(data: Uint8Array, expected: number): boolean;
}
