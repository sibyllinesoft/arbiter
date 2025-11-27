import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as smartNaming from "../../utils/smart-naming.js";
import { versionPlanCommand, versionReleaseCommand } from "../version/index.js";

const baseConfig = { projectName: "demo" } as any;

async function withTempDir(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-version-"));
  const previous = process.cwd();
  process.chdir(tmp);
  try {
    await run(tmp);
  } finally {
    process.chdir(previous);
    await rm(tmp, { recursive: true, force: true });
  }
}

describe("version service", () => {
  it("generates a version plan from current and previous surfaces", async () => {
    await withTempDir(async () => {
      const current = { endpoints: [{ method: "GET", path: "/foo" }] };
      const previous = { endpoints: [{ method: "GET", path: "/bar" }] };
      await writeFile("surface.json", JSON.stringify(current), "utf-8");
      await writeFile("surface.prev.json", JSON.stringify(previous), "utf-8");

      const exitCode = await versionPlanCommand({}, baseConfig);
      expect(exitCode).toBe(0);

      const plan = JSON.parse(await readFile("version-plan.json", "utf-8"));
      expect(plan.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "added", endpoint: "GET /foo" }),
          expect.objectContaining({ type: "removed", endpoint: "GET /bar" }),
        ]),
      );
      expect(plan.suggestedBump).toBe("MAJOR");
    });
  });

  it("fails gracefully when surface files are missing", async () => {
    await withTempDir(async () => {
      const code = await versionPlanCommand({}, baseConfig);
      expect(code).toBe(1);
    });
  });

  it("supports dry run and release note generation", async () => {
    await withTempDir(async () => {
      const smartSpy = spyOn(smartNaming, "resolveSmartNaming").mockReturnValue({
        projectSlug: "demo",
        configPrefix: "demo",
        surfacePrefix: "demo",
      } as any);

      await writeFile("demo.json", "{}", "utf-8");
      const plan = { targetVersion: "1.2.3", changes: [{ type: "added", endpoint: "GET /foo" }] };
      await writeFile("version-plan.json", JSON.stringify(plan), "utf-8");

      const dryRunCode = await versionReleaseCommand(
        { plan: "version-plan.json", dryRun: true },
        baseConfig,
      );
      expect(dryRunCode).toBe(0);
      expect(await fsExists("RELEASE_NOTES.md")).toBe(false);

      const releaseCode = await versionReleaseCommand(
        { plan: "version-plan.json", notes: "NOTES.md" },
        baseConfig,
      );
      expect(releaseCode).toBe(0);

      const notes = await readFile("NOTES.md", "utf-8");
      expect(notes).toContain("# Release 1.2.3");
      expect(notes).toContain("GET /foo");

      smartSpy.mockRestore();
    });
  });
});

async function fsExists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}
