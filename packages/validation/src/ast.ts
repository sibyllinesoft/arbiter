import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CueRunner } from "./index.js";

export interface CueNode {
  path: string;
  value: unknown;
  children: CueNode[];
}

export interface CueAst {
  root: CueNode;
}

/**
 * Parses CUE content into an AST representation.
 *
 * Creates a temporary workspace, exports the CUE to JSON, then builds a tree structure.
 *
 * @param content - Raw CUE content string to parse
 * @returns AST with root node containing the parsed structure
 * @throws Error if CUE parsing or export fails
 */
export async function parseCueToAst(content: string): Promise<CueAst> {
  const workspace = mkdtempSync(path.join(tmpdir(), "cue-ast-"));
  const filePath = path.join(workspace, "input.cue");
  writeFileSync(filePath, content, "utf-8");

  try {
    const runner = new CueRunner({ cwd: workspace });
    const result = await runner.exportJson(["./..."]);

    if (!result.success || !result.value) {
      const diagnostic = result.diagnostics[0];
      const reason = diagnostic?.message || result.error || "Failed to export CUE as JSON";
      throw new Error(reason);
    }

    return {
      root: buildTree(result.value, "<root>"),
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

/** Recursively builds a tree of CueNode from a JSON value. */
function buildTree(value: unknown, path: string): CueNode {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    const children = entries.map(([key, val]) => buildTree(val, `${path}.${key}`));
    return {
      path,
      value,
      children,
    };
  }

  if (Array.isArray(value)) {
    const children = value.map((item, index) => buildTree(item, `${path}[${index}]`));
    return {
      path,
      value,
      children,
    };
  }

  return {
    path,
    value,
    children: [],
  };
}
