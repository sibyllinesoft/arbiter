/**
 * Utility functions for concurrency and race condition tests
 */
import type { Fragment } from "../../util/types";

export interface FragmentTimingResult {
  response: Response;
  duration: number;
  timestamp: number;
}

export interface ResolvedSpec {
  resolved: Record<string, unknown>;
  spec_hash?: string;
}

export interface ValidationResult {
  success: boolean;
  spec_hash: string;
  resolved?: Record<string, unknown>;
  errors?: unknown[];
}

/**
 * Create a fragment with precise timing control for concurrency testing
 */
export async function createFragmentWithTiming(
  baseUrl: string,
  projectId: string,
  path: string,
  content: string,
  delayMs = 0,
): Promise<FragmentTimingResult> {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const start = Date.now();
  const response = await fetch(`${baseUrl}/api/fragments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      path,
      content,
    }),
  });
  const duration = Date.now() - start;

  return { response, duration, timestamp: start };
}

/**
 * Validate project and get resolved spec
 */
export async function getResolvedSpec(
  baseUrl: string,
  projectId: string,
): Promise<ResolvedSpec | null> {
  const validationResponse = await fetch(`${baseUrl}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (validationResponse.status !== 200) {
    return null;
  }

  const result = await validationResponse.json();
  if (!result.success) {
    return null;
  }

  const resolvedResponse = await fetch(`${baseUrl}/api/resolved?project_id=${projectId}`);

  if (resolvedResponse.status !== 200) {
    return null;
  }

  return await resolvedResponse.json();
}

/**
 * Create multiple fragments concurrently and collect results
 */
export async function createFragmentsConcurrently(
  baseUrl: string,
  projectId: string,
  fragments: Array<{ path: string; content: string; delayMs?: number }>,
): Promise<FragmentTimingResult[]> {
  const promises = fragments.map(({ path, content, delayMs }) =>
    createFragmentWithTiming(baseUrl, projectId, path, content, delayMs ?? 0),
  );
  return Promise.all(promises);
}

/**
 * Run validation on a project
 */
export async function validateProject(
  baseUrl: string,
  projectId: string,
): Promise<{ response: Response; result: ValidationResult }> {
  const response = await fetch(`${baseUrl}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });
  const result = await response.json();
  return { response, result };
}

/**
 * Get all fragments for a project
 */
export async function getProjectFragments(
  baseUrl: string,
  projectId: string,
): Promise<{ response: Response; fragments: Fragment[] }> {
  const response = await fetch(`${baseUrl}/api/fragments?project_id=${projectId}`);
  const fragments = response.status === 200 ? await response.json() : [];
  return { response, fragments };
}

/**
 * Extract response from mixed result types (plain Response or object with response property)
 */
export function extractResponse(result: Response | { response: Response }): Response {
  return result instanceof Response ? result : result.response;
}

/**
 * Generate CUE fragment content for testing
 */
export function generateCueContent(identifier: string, data: Record<string, unknown> = {}): string {
  const entries = Object.entries(data)
    .map(([key, value]) => {
      const formattedValue =
        typeof value === "string"
          ? `"${value}"`
          : typeof value === "object"
            ? JSON.stringify(value)
            : value;
      return `\t${key}: ${formattedValue}`;
    })
    .join("\n");

  return `package spec\n\n${identifier}: {\n${entries || "\t// empty"}\n}`;
}

/**
 * Generate large CUE content for stress testing
 */
export function generateLargeCueContent(identifier: string, fieldCount: number): string {
  const fields = Array.from(
    { length: fieldCount },
    (_, j) => `\tfield_${j}: "large_string_value_${"x".repeat(50)}_${j}"`,
  ).join("\n");

  return `package spec\n\n${identifier}: {\n${fields}\n}`;
}

/**
 * Wait for a specified delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find the result with the latest timestamp
 */
export function findLatestResult(results: FragmentTimingResult[]): FragmentTimingResult {
  return results.reduce((latest, current) =>
    current.timestamp > latest.timestamp ? current : latest,
  );
}

/**
 * Database operation types for concurrent testing
 */
export type DbOperationType = "create" | "validate" | "list";

/**
 * Generate a mixed database operation for concurrent testing.
 * Cycles through create, validate, and list operations based on index.
 */
export function generateDbOperation(
  index: number,
  createFn: () => Promise<FragmentTimingResult>,
  validateFn: () => Promise<{ response: Response }>,
  listFn: () => Promise<{ response: Response }>,
): Promise<Response | FragmentTimingResult> {
  const operationType = index % 3;
  switch (operationType) {
    case 0:
      return createFn();
    case 1:
      return validateFn().then((r) => r.response);
    case 2:
      return listFn().then((r) => r.response);
    default:
      return createFn();
  }
}

/**
 * Resource exhaustion operation types for stress testing
 */
export type ResourceOperationType = "cpu" | "memory" | "validate" | "ir";

/**
 * Generate resource-intensive operations for stress testing.
 * Cycles through CPU, memory, validation, and IR operations.
 */
export function generateResourceOperation(
  index: number,
  baseUrl: string,
  projectId: string,
  createFragmentFn: (path: string, content: string) => Promise<FragmentTimingResult>,
  validateFn: () => Promise<{ response: Response }>,
): Promise<Response | FragmentTimingResult> | null {
  const operationType = index % 4;
  switch (operationType) {
    case 0: // CPU-intensive validation
      return createFragmentFn(
        `heavy_${index}.cue`,
        `package spec\n\n// Complex nested structure\nheavy${index}: {\n\tfor i, v in list.Range(0, 100, 1) {\n\t\t"item_\\(i)": {\n\t\t\tid: i\n\t\t\tvalue: v * 2\n\t\t\tvalidation: string & =~"^[a-z]+$"\n\t\t}\n\t}\n}`,
      );
    case 1: // Memory-intensive content
      return createFragmentFn(
        `large_${index}.cue`,
        generateLargeCueContent(`large_data${index}`, 200),
      );
    case 2: // Validation operation
      return validateFn().then((r) => r.response);
    case 3: // IR generation (skip if too early)
      if (index > 5) {
        return fetch(`${baseUrl}/api/ir?project_id=${projectId}&type=capabilities`);
      }
      return null;
    default:
      return null;
  }
}
