import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  compareSchemas,
  diffCommand,
  generateMigrationScript,
  parseCueStructure,
} from "@/services/diff/index.js";

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "arb-diff-"));

describe("diff service helpers", () => {
  it("parses CUE structures with package/imports and fields", async () => {
    const dir = await tmp();
    const file = path.join(dir, "a.cue");
    await fs.writeFile(
      file,
      `
// comment
package demo
import utils "github.com/acme/utils"

foo: string
#Constraint: {
  limit: <=10
}
`,
    );

    const structure = await parseCueStructure(file);
    expect(structure.get("package")).toBe("demo");
    expect(structure.get("import.utils")).toBe("github.com/acme/utils");
    expect(structure.get("foo")).toContain("string");
    expect(structure.has("constraint.Constraint")).toBe(true);
  });

  it("detects added/removed/modified schema entries and compatibility", () => {
    const oldStruct = new Map<string, string>([
      ["package", "demo"],
      ["field", "string"],
      ["constraint.limit", "<=10"],
    ]);
    const newStruct = new Map<string, string>([
      ["package", "demo"],
      ["field", "int"], // modified type
      ["newField", "string"], // added
    ]);

    const changes = compareSchemas(oldStruct, newStruct);
    const descriptions = changes.map((c) => c.description);
    expect(descriptions.some((d) => d.includes("Added"))).toBe(true);
    expect(descriptions.some((d) => d.includes("Removed"))).toBe(true);
    expect(descriptions.some((d) => d.includes("Modified"))).toBe(true);
  });

  it("creates migration scripts when breaking changes exist", () => {
    const script = generateMigrationScript({
      summary: { total_changes: 1, breaking_changes: 1, added: 0, removed: 1, modified: 0 },
      changes: [
        {
          type: "removed",
          category: "field",
          location: "foo",
          impact: "breaking",
          description: "Removed field foo",
          migration_hint: "Remove references",
        },
      ],
      migration_needed: true,
      compatibility_score: 80,
    });

    expect(script).toContain("Schema Migration Script");
    expect(script).toContain("Action required");
  });
});

describe("diff command", () => {
  it("returns error when files are missing", async () => {
    const errSpy = spyOn(console, "error").mockImplementation(() => {});
    const code = await diffCommand("missing-old.cue", "missing-new.cue", { format: "json" });
    expect(code).toBe(1);
    errSpy.mockRestore();
  });

  it("outputs structured diff and migration guide when breaking", async () => {
    const dir = await tmp();
    const oldFile = path.join(dir, "old.cue");
    const newFile = path.join(dir, "new.cue");
    await fs.writeFile(
      oldFile,
      'package demo\nimport util "github.com/acme/util"\n#Rule: <=10\nfoo: string\n',
    );
    await fs.writeFile(newFile, "package demo\nfoo: string\n");

    const logSpy: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => logSpy.push(String(msg));

    const code = await diffCommand(oldFile, newFile, { format: "json", migration: true });
    console.log = origLog;

    expect(code).toBe(1); // breaking change should signal non-zero
    const combined = logSpy.join("\n");
    expect(combined).toContain('"migration_needed": true');
  });
});
