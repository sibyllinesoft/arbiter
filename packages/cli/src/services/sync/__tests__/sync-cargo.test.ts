import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import * as constraints from "../../../constraints/index.js";
import { syncCargoToml } from "../index.js";

describe("sync cargo", () => {
  it("adds arbiter metadata when missing", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "cargo-sync-"));
    const filePath = path.join(tmp, "Cargo.toml");
    await writeFile(filePath, `[package]\nname = "demo"\nversion = "0.1.0"\n[dependencies]\n`);

    const safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, p, writer) => writer(p),
    );

    const result = await syncCargoToml(filePath, false, false, false);
    expect(result.modified).toBe(true);
    safeSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });

  it("preserves existing arbiter metadata unless forced", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "cargo-sync-"));
    const filePath = path.join(tmp, "Cargo.toml");
    await writeFile(
      filePath,
      `[package]\nname = "demo"\nversion = "0.1.0"\n[package.metadata.arbiter]\nfoo="bar"\n`,
    );

    const result = await syncCargoToml(filePath, false, false, false);
    expect(result.modified).toBe(false);
    expect(result.conflicts[0]?.resolution).toBe("preserved_existing");

    await rm(tmp, { recursive: true, force: true });
  });
});
