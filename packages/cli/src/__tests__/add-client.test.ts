import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { addClient } from "@/services/add/subcommands/client";
import fs from "fs-extra";

const manipulator = {
  addToSection: async (_c: string, _section: string, key: string, cfg: any) =>
    JSON.stringify({ key, cfg }),
};

describe("addClient helper", () => {
  it("creates default client directory when no template", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "add-client-"));
    const cwd = process.cwd();
    process.chdir(tmpDir);

    const result = await addClient(manipulator, "", "Web Portal", {});
    const parsed = JSON.parse(result);
    expect(parsed.key).toBe("web-portal");

    const dirExists = await fs.pathExists(path.join(tmpDir, "clients", "web-portal"));
    expect(dirExists).toBe(true);

    process.chdir(cwd);
    await fs.remove(tmpDir);
  });
});
