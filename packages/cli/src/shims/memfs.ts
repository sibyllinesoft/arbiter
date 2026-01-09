/**
 * @packageDocumentation
 * Minimal shim for memfs to keep Bun standalone builds working.
 *
 * Proxies to the native fs module; sufficient for CLI paths that never depend on memfs specifics.
 */

import fs from "node:fs";

/** Stub Volume class for compatibility. */
export const Volume = class {};
/** Volume instance proxying to native fs. */
export const vol = fs as unknown as any;
/** Create fs from volume - returns native fs. */
export const createFsFromVolume = () => fs as unknown as any;
/** Sync methods stub. */
export const fsSyncMethods = undefined;
/** Async methods stub. */
export const fsAsyncMethods = undefined;

/**
 * Create a memfs-compatible file system instance.
 * @returns Native fs module for compatibility
 */
export function memfs() {
  return createFsFromVolume();
}

/** Exported fs functions. */
export const fsExports = memfs();

/** Default export combining all memfs-compatible exports. */
const defaultExport = Object.assign({}, fsExports, {
  Volume,
  vol,
  createFsFromVolume,
  memfs,
  fs: fsExports,
  semantic: true,
});

export default defaultExport;
