/**
 * Type declarations for cue-wasm
 * @see https://github.com/nicholasoxford/cue-wasm
 */
declare module "cue-wasm" {
  export interface CueWasmInstance {
    /**
     * Parse CUE content and return the evaluated value
     * @param content - CUE content to parse
     * @returns Evaluated value as JavaScript object
     * @throws Error if parsing fails
     */
    parse(content: string): unknown;
  }

  /**
   * Initialize the CUE WASM runtime
   * @returns Promise resolving to the initialized CUE instance
   */
  export function init(): Promise<CueWasmInstance>;
}
