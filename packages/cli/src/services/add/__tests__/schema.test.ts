import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";

import * as constraints from "@/constraints/index.js";
import { addSchema } from "@/services/add/subcommands/definitions/schema.js";
import * as schemaModule from "@/services/add/subcommands/definitions/schema.js";
import fs from "fs-extra";

const manipulator = {
  addToSection: mock(async (_content: string, _section: string, name: string, cfg: any) => {
    return `added:${name}:${JSON.stringify(cfg)}`;
  }),
};

afterEach(() => {
  mock.restore();
});

describe("addSchema", () => {
  it("validates JSON inputs and falls back on conversion failure", async () => {
    // Arrange conversion to fail to exercise warning path via spawn close code 1
    mock.module("node:child_process", () => {
      return {
        spawn: () => {
          const proc: any = new EventEmitter();
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          setImmediate(() => {
            proc.stderr.emit("data", "boom");
            proc.emit("close", 1);
          });
          return proc;
        },
      };
    });
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const result = await addSchema(manipulator as any, "content", "User Profile", {
      example: '{"id":1}',
      rules: '{"type":"object"}',
      format: "json-schema",
    });

    expect(result).toContain("added:User Profile");
    expect(warn).toHaveBeenCalled(); // warning branch hit
  });

  it("throws on invalid example or rules JSON", async () => {
    await expect(addSchema(manipulator as any, "c", "name", { example: "{bad" })).rejects.toThrow(
      "Invalid example format",
    );
    await expect(addSchema(manipulator as any, "c", "name", { rules: "{bad" })).rejects.toThrow(
      "Invalid rules format",
    );
  });
});

describe("convertJsonSchemaRulesToCue", () => {
  it("writes schema files and returns cue details", async () => {
    // Mock safeFileOperation to bypass actual disk safety enforcement
    spyOn(constraints, "safeFileOperation").mockImplementation(async (_op, target, fn) => {
      await fn(target);
    });

    // Mock spawn-based cue import to return deterministic content
    mock.module("node:child_process", () => {
      return {
        spawn: () => {
          const proc: any = new EventEmitter();
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          setImmediate(() => {
            proc.stdout.emit("data", "cue: schema {}");
            proc.emit("close", 0);
          });
          return proc;
        },
      };
    });

    const result = await (schemaModule as any).convertJsonSchemaRulesToCue("Demo_Schema", {
      type: "object",
    });

    expect(result.cue).toContain("schema");
    expect(result.cueFile).toMatch(/schemas\/demo-schema.cue/);
    expect(await fs.pathExists(path.resolve(".arbiter", result.cueFile.replace("./", "")))).toBe(
      true,
    );
  });
});
