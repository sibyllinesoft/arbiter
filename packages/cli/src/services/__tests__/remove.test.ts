import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getCueManipulator } from "../../constraints/cli-integration.js";
import { removeCommand } from "../remove/index.js";

describe("removeCommand", () => {
  it("returns error when no assembly file is found", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-remove-"));
    const cwd = process.cwd();
    process.chdir(dir);
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await removeCommand("service", "demo", {}, { localMode: true } as any);
    process.chdir(cwd);
    err.mockRestore();
    expect(code).toBe(1);
  });
});
