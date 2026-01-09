/**
 * Utility functions for golden file comparison
 */
import { expect } from "bun:test";
import { join } from "node:path";
import { generateId } from "../../io/utils";
import type { Fragment } from "../../util/types";

/** Keys that contain dynamic values and should be compared differently */
const TIMESTAMP_KEYS = new Set(["generated_at", "created_at", "updated_at"]);

/** Check if a key represents a generated ID */
function isGeneratedId(key: string, value: unknown): boolean {
  return key === "id" && typeof value === "string" && value.length > 10;
}

/** Validate a timestamp value */
function validateTimestamp(value: unknown): void {
  expect(value).toBeDefined();
  expect(typeof value).toBe("string");
  expect(new Date(value as string).getTime()).toBeGreaterThan(0);
}

/** Validate a generated ID value */
function validateGeneratedId(value: unknown): void {
  expect(value).toBeDefined();
  expect(typeof value).toBe("string");
  expect((value as string).length).toBeGreaterThan(0);
}

/** Compare two array values recursively */
function compareArrays(actual: unknown[], expected: unknown[], path: string): void {
  expect(Array.isArray(actual)).toBe(true);
  expect(actual.length).toBe(expected.length);

  for (let i = 0; i < expected.length; i++) {
    compareWithTolerance(actual[i], expected[i], `${path}[${i}]`);
  }
}

/** Compare two object values recursively */
function compareObjects(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  path: string,
): void {
  for (const key in expected) {
    if (TIMESTAMP_KEYS.has(key)) {
      validateTimestamp(actual[key]);
    } else if (isGeneratedId(key, expected[key])) {
      validateGeneratedId(actual[key]);
    } else {
      expect(actual).toHaveProperty(key);
      compareWithTolerance(actual[key], expected[key], `${path}.${key}`);
    }
  }
}

/**
 * Deep comparison with tolerance for timestamps and generated IDs.
 * Used for golden file testing where some values (like timestamps and IDs)
 * are expected to vary between runs.
 */
export function compareWithTolerance(actual: unknown, expected: unknown, path = ""): void {
  if (typeof expected !== typeof actual) {
    throw new Error(`Type mismatch at ${path}: expected ${typeof expected}, got ${typeof actual}`);
  }

  if (expected === null || actual === null) {
    expect(actual).toBe(expected);
    return;
  }

  if (typeof expected !== "object") {
    expect(actual).toBe(expected);
    return;
  }

  if (Array.isArray(expected)) {
    compareArrays(actual as unknown[], expected, path);
  } else {
    compareObjects(actual as Record<string, unknown>, expected as Record<string, unknown>, path);
  }
}

/**
 * Load golden test project fragments from a directory.
 * Returns an array of Fragment objects for testing.
 */
export async function loadGoldenFragments(
  projectPath: string,
  fragmentFiles: string[],
  projectId = "golden-test-project",
): Promise<Fragment[]> {
  const fragments: Fragment[] = [];

  for (const filename of fragmentFiles) {
    const filePath = join(projectPath, filename);
    const content = await Bun.file(filePath).text();

    fragments.push({
      id: generateId(),
      project_id: projectId,
      path: filename,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return fragments;
}

/**
 * Load expected golden file JSON content.
 */
export async function loadExpectedFile(projectPath: string, filename: string): Promise<unknown> {
  const filePath = join(projectPath, "expected", filename);
  const content = await Bun.file(filePath).text();
  return JSON.parse(content);
}

/**
 * Validate IR generation result structure.
 */
export function validateIRStructure(
  ir: { kind: string; data: Record<string, unknown> },
  expectedKind: string,
  expectedDataType: string,
): void {
  expect(ir.kind).toBe(expectedKind);
  expect((ir.data as Record<string, unknown>).type).toBe(expectedDataType);
}
