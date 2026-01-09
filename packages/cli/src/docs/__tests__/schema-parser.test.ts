import { afterAll, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import { CUESchemaParser } from "@/docs/parser/schema-parser.js";

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-cue-schema-"));
  tmpDirs.push(dir);
  return dir;
}

const runner = {
  // Minimal stub that mirrors CueRunner.exportJson API
  exportJson: async (args: string[]) => {
    const file = args[0];
    if (file.includes("a.cue")) {
      return { success: true, value: { user: { name: "alice", _secret: true, age: 30 } } };
    }
    if (file.includes("b.cue")) {
      return { success: true, value: { widget: { specs: { height: 10 } } } };
    }
    return { success: false, error: "unknown file" };
  },
};

describe("CUESchemaParser", () => {
  it("parses a single file and omits private fields by default", async () => {
    const dir = makeTmpDir();
    const file = path.join(dir, "a.cue");
    await fs.writeFile(file, "package demo\n// user schema\n", "utf-8");

    const parser = new CUESchemaParser({ runner });
    const parsed = await parser.parseFile(file);

    const root = parsed.types.get("Root");
    expect(root?.fields?.map((f) => f.name)).toEqual(["user"]);

    const user = parsed.types.get("User");
    expect(user?.fields?.some((f) => f.name === "_secret")).toBe(false);
    expect(user?.fields?.some((f) => f.name === "age")).toBe(true);
  });

  it("includes private fields when requested and builds usedBy relationships", async () => {
    const dir = makeTmpDir();
    const fileA = path.join(dir, "a.cue");
    const fileB = path.join(dir, "b.cue");
    await fs.writeFile(fileA, "package demo\n// file A\n", "utf-8");
    await fs.writeFile(fileB, "package demo\n// file B\n", "utf-8");

    const parser = new CUESchemaParser({ runner, includePrivate: true });
    const parsed = await parser.parseFiles([fileA, fileB]);

    const user = parsed.types.get("User");
    expect(user?.fields?.some((f) => f.name === "_secret")).toBe(true);
    const widgetUsedBy = parsed.types.get("Widget")?.usedBy ?? [];
    expect(widgetUsedBy).toContain("Root");
  });

  it("throws when no .cue files are present in a directory", async () => {
    const dir = makeTmpDir();
    const parser = new CUESchemaParser({ runner });
    await expect(parser.parseSchemaDirectory(dir)).rejects.toThrow("No .cue files found");
  });
});

// Cleanup created temp directories
afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => fs.remove(dir)));
});
