import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EpicLoader } from "../execute/index.js";

describe("EpicLoader", () => {
  it("throws when required fields are missing", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-epic-"));
    const epicPath = path.join(dir, "epic.json");
    await fs.writeFile(epicPath, JSON.stringify({ id: "1" }), "utf8");

    const loader = new EpicLoader(epicPath);
    await expect(loader.load()).rejects.toThrow("Invalid epic");
  });
});
