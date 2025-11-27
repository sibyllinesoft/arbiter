import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as constraints from "../../../constraints/index.js";
import {
  calculateChecksum,
  deepMerge,
  detectManifestFiles,
  generateChangeSet,
  validateIdempotency,
  writeFileSafely,
} from "../index.js";

describe("sync helpers", () => {
  it("detects manifest files that exist", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arb-sync-"));
    await writeFile(path.join(tmp, "package.json"), "{}");
    await writeFile(path.join(tmp, "Cargo.toml"), '[package]\nname="demo"\n');

    const manifests = await detectManifestFiles(tmp);
    const types = manifests.map((m) => m.type);
    expect(types).toEqual(expect.arrayContaining(["package.json", "Cargo.toml"]));

    await rm(tmp, { recursive: true, force: true });
  });

  it("calculates deterministic checksum and validates idempotency", async () => {
    const content = '{"name":"demo"}';
    const checksum = calculateChecksum(content);
    expect(checksum).toHaveLength(16);
    expect(calculateChecksum(content)).toBe(checksum);

    const tmp = await mkdtemp(path.join(os.tmpdir(), "arb-sync-check-"));
    const filePath = path.join(tmp, "pkg.json");
    await writeFile(filePath, content);

    expect(await validateIdempotency(filePath, checksum)).toBe(true);
    await writeFile(filePath, '{"name":"changed"}');
    expect(await validateIdempotency(filePath, checksum)).toBe(false);

    await rm(tmp, { recursive: true, force: true });
  });

  it("deep merges objects and records conflicts", () => {
    const conflicts: any[] = [];
    const result = deepMerge(
      { a: 1, nested: { same: 1, change: 1 } },
      { a: 1, nested: { same: 1, change: 2, add: 3 } },
      conflicts,
      "",
      false,
    );

    expect(result.nested.add).toBe(3);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].resolution).toBe("preserved_existing");
  });

  it("deepMerge replaces conflicts when force=true", () => {
    const conflicts: any[] = [];
    const result = deepMerge({ version: 1 }, { version: 2 }, conflicts, "", true);
    expect(result.version).toBe(2);
    expect(conflicts[0].applied).toBe(true);
  });

  it("generates change sets for added, modified, and removed keys", () => {
    const original = { a: 1, b: 2, c: 3 };
    const modified = { a: 1, b: 5, d: 9 };
    const changeSet = generateChangeSet(original, modified);
    expect(changeSet.added).toHaveProperty("d");
    expect(changeSet.modified.b.from).toBe(2);
    expect(changeSet.removed).toHaveProperty("c");
  });

  it("writes files via safeFileOperation", async () => {
    const safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, p, writer) => writer(p),
    );
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arb-sync-write-"));
    const filePath = path.join(tmp, "out.txt");

    await writeFileSafely(filePath, "hello");
    const written = await Bun.file(filePath).text();
    expect(written).toBe("hello");
    expect(safeSpy).toHaveBeenCalled();

    safeSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });
});
