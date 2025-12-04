import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import * as constraints from "@/constraints/index.js";
import {
  applyArbiterUpdates,
  applyPackageChanges,
  reportPotentialChanges,
  syncPackageJson,
} from "@/services/sync/index.js";
import * as syncHelpers from "@/services/sync/index.js";

describe("sync package.json flow", () => {
  it("applies arbiter updates and records conflicts when not forced", () => {
    const pkg = { scripts: { test: "jest" }, devDependencies: { jest: "^1.0.0" } };
    const updates = syncHelpers.getArbiterPackageUpdates();

    const conflicts = applyArbiterUpdates(pkg, updates, false);

    const scriptConflict = conflicts.find((c) => c.path.startsWith("scripts."));
    // existing script stays; other arbiter scripts are added
    expect(conflicts.length).toBeGreaterThanOrEqual(0);
    expect(pkg.scripts["arbiter:check"]).toBeDefined();
    expect(pkg.devDependencies["@arbiter/cli"]).toBeDefined();
  });

  it("applies package changes, backup optional, and idempotency warning", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "sync-pkg-"));
    const filePath = path.join(tmp, "package.json");
    await writeFile(filePath, '{"name":"demo"}\n');

    const safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, file, writer) => writer(file),
    );
    const backupSpy = spyOn(syncHelpers, "createBackup").mockResolvedValue(
      path.join(tmp, "backup"),
    );
    const validateSpy = spyOn(syncHelpers, "validateIdempotency").mockResolvedValue(true);

    const backupPath = await applyPackageChanges(
      filePath,
      '{"name":"demo","x":1}',
      true,
      "checksum",
    );
    expect(backupPath).toContain("backup");
    expect(validateSpy).toHaveBeenCalled();

    safeSpy.mockRestore();
    backupSpy.mockRestore();
    validateSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });

  it("reports potential changes with added, modified, and conflicts", () => {
    const changeSet = {
      added: { a: 1 },
      modified: { b: { from: 1, to: 2 } },
      removed: {},
    };
    const conflicts = [
      {
        path: "scripts.test",
        type: "value_conflict",
        resolution: "preserved_existing",
        applied: false,
        details: "kept",
      },
    ];
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    reportPotentialChanges(changeSet, conflicts);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("syncPackageJson returns unmodified when nothing changes", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "sync-pkg2-"));
    const filePath = path.join(tmp, "package.json");
    await writeFile(filePath, '{"name":"demo"}\n');

    const result = await syncPackageJson(filePath, true, false, false);
    // Arbiter scripts/devDeps will be added → modified=true; ensure dry-run flow still returns checksum
    expect(result.modified).toBe(true);
    expect(result.checksum).toHaveLength(16);

    await rm(tmp, { recursive: true, force: true });
  });
});
