/**
 * Environment utilities for handling environment variable maps
 */

/** Map of environment variables */
export type EnvironmentMap = Record<string, unknown>;

/**
 * Merge multiple environment sources into a single map.
 * Later sources override earlier ones.
 */
export function mergeEnvironmentSources(...sources: unknown[]): EnvironmentMap {
  const result: EnvironmentMap = {};

  for (const source of sources) {
    if (source && typeof source === "object" && !Array.isArray(source)) {
      Object.assign(result, source);
    }
  }

  return result;
}
