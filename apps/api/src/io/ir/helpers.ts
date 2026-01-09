/**
 * Helper functions for IR generation.
 * Provides utilities for extracting and transforming spec data into IR structures.
 */

/**
 * Compute a simple hash for a resolved spec.
 * Used for cache invalidation and change detection.
 * @param resolved - The resolved specification object
 * @returns A hash string based on the spec content length
 */
export function computeSpecHash(resolved: Record<string, unknown>): string {
  return `sha256-${JSON.stringify(resolved).length.toString(16)}`;
}

/**
 * Determine the kind/type of a flow step.
 * Inspects step properties to classify the action type.
 * @param step - The flow step object to classify
 * @returns The step kind (visit, click, fill, expect, expect_api, or process)
 */
export function getFlowStepKind(step: any): string {
  if (step.type) return step.type;
  if (step.visit) return "visit";
  if (step.click) return "click";
  if (step.fill) return "fill";
  if (step.expect) return "expect";
  if (step.expect_api) return "expect_api";
  return "process";
}

/**
 * Generate a human-readable label for a flow step.
 * Creates descriptive labels based on step properties.
 * @param step - The flow step object
 * @param index - The step's position in the flow (0-indexed)
 * @returns A descriptive label for the step
 */
export function getFlowStepLabel(step: any, index: number): string {
  if (step.name) return step.name;
  if (step.visit) return `Visit: ${step.visit}`;
  if (step.click) return `Click: ${step.click}`;
  if (step.fill) return `Fill: ${step.fill}`;
  if (step.expect) return `Expect: ${step.expect.locator || step.expect}`;
  if (step.expect_api) return `API: ${step.expect_api.method} ${step.expect_api.path}`;
  return `Step ${index + 1}`;
}

/**
 * Extract flows from a resolved specification.
 * @param resolved - The resolved specification object
 * @returns A record of flow definitions, or empty object if none
 */
export function extractFlows(resolved: Record<string, unknown>): Record<string, any> {
  return (resolved.flows as Record<string, any>) || {};
}

/**
 * Extract a nested record from a resolved specification by key.
 * Safely handles missing or non-object values.
 * @param resolved - The resolved specification object
 * @param key - The key to extract
 * @returns The extracted record, or empty object if not found/invalid
 */
export function extractAsRecord(
  resolved: Record<string, unknown>,
  key: string,
): Record<string, any> {
  const value = resolved[key];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
}

/**
 * Count the number of nodes in a data structure.
 * Used for statistics and validation.
 * @param data - Data structure potentially containing a nodes array
 * @returns The count of nodes, or 0 if none
 */
export function getNodeCount(data: Record<string, unknown>): number {
  const nodes = data.nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
}
