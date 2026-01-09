import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { CUESchemaParser } from "@/docs/parser/schema-parser.js";
import fs from "fs-extra";

const mockRunner = {
  async exportJson(_paths: string[]) {
    return {
      success: true,
      value: {
        user: {
          name: "Jane",
          age: 30,
          address: {
            street: "Main",
            zip: 12345,
          },
        },
        active: true,
      },
      diagnostics: [],
    };
  },
};

describe("CUESchemaParser (cue-runner backed)", () => {
  it("produces struct types from cue-runner exportJson output", async () => {
    const tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cue-parser-")), "fake.cue");
    fs.writeFileSync(tmpFile, "package demo\n");

    const parser = new CUESchemaParser({ runner: mockRunner as any });
    const schema = await parser.parseFile(tmpFile);

    const types = Array.from(schema.types.values());
    const root = schema.types.get("Root");
    const user = schema.types.get("User");
    const address = schema.types.get("UserAddress");

    expect(root).toBeDefined();
    expect(user).toBeDefined();
    expect(address).toBeDefined();
    expect(root?.fields?.some((f) => f.name === "user" && f.type === "User")).toBe(true);
    expect(user?.fields?.some((f) => f.name === "address" && f.type === "UserAddress")).toBe(true);
    // root + user + address
    expect(types.length).toBeGreaterThanOrEqual(3);
  });

  it("surfaces cue-runner diagnostics on failure", async () => {
    const failingRunner = {
      async exportJson() {
        return { success: false, diagnostics: [{ message: "parse error" }] };
      },
    };
    const tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cue-parser-")), "invalid.cue");
    fs.writeFileSync(tmpFile, "package demo\ninvalid: \n");

    const parser = new CUESchemaParser({ runner: failingRunner as any });
    await expect(parser.parseFile(tmpFile)).rejects.toThrow("parse error");
  });
});
