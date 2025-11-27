import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "../execute/index.js";

async function inTempWorkspace(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-exec-apply-"));
  const prev = process.cwd();
  const originalTty = process.stdout.isTTY;
  process.chdir(tmp);
  (process.stdout as any).isTTY = true;
  try {
    await run(tmp);
  } finally {
    process.chdir(prev);
    (process.stdout as any).isTTY = originalTty;
    await rm(tmp, { recursive: true, force: true });
  }
}

describe("executeCommand apply mode", () => {
  it("applies generated files and writes reports", async () => {
    await inTempWorkspace(async (tmp) => {
      const templatePath = path.join(tmp, "tmpl.txt");
      await writeFile(templatePath, "Hello {{.name}}", "utf-8");

      const epic = {
        id: "epic-apply",
        title: "Apply Epic",
        owners: ["alice"],
        targets: [],
        generate: [
          {
            path: path.join(tmp, "out", "demo.txt"),
            mode: "create" as const,
            template: templatePath,
            data: { name: "World" },
            guards: [] as string[],
          },
        ],
        contracts: { types: [], invariants: [] },
        tests: { static: [], property: [], golden: [], cli: [] },
        rollout: { steps: [], gates: [] },
        heuristics: { preferSmallPRs: true, maxFilesPerPR: 10 },
      };

      const epicPath = path.join(tmp, "epic.json");
      await writeFile(epicPath, JSON.stringify(epic), "utf-8");

      const exitCode = await executeCommand({
        epic: epicPath,
        workspace: tmp,
        junit: true,
        agentMode: true,
      });

      expect(exitCode).toBe(0);
      const output = await readFile(path.join(tmp, "out", "demo.txt"), "utf-8");
      expect(output.trim()).toBe("Hello World");

      // Reports are written by StandardizedOutputManager
      expect(await fileExists(path.join(tmp, "report.json"))).toBe(true);
      expect(await fileExists(path.join(tmp, "junit.xml"))).toBe(true);
    });
  });
});

async function fileExists(target: string): Promise<boolean> {
  try {
    await readFile(target);
    return true;
  } catch {
    return false;
  }
}
