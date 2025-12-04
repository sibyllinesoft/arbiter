import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { FileSystemConstraints } from "@/constraints/filesystem";
import fs from "fs-extra";

describe("filesystem constraints", () => {
  it("validates an existing file path", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fs-"));
    const file = path.join(tmpDir, "file.txt");
    await fs.writeFile(file, "data");

    const enforcer = new FileSystemConstraints();
    const result = await enforcer.validatePath(file, "read");

    expect(result.isValid).toBe(true);
    await fs.remove(tmpDir);
  });
});
