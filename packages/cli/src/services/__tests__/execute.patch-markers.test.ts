import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "@/services/execute/index.js";

async function inTempWorkspace(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-exec-patch-"));
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

describe("PlanExecutor marker patching", () => {
  it("replaces multiple marker blocks while keeping others untouched", async () => {
    await inTempWorkspace(async (tmp) => {
      const targetPath = path.join(tmp, "out", "multi.txt");
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(
        targetPath,
        [
          "// ARBITER:BEGIN A oldA // ARBITER:END A",
          "// ARBITER:BEGIN B oldB // ARBITER:END B",
        ].join("\n"),
        "utf-8",
      );

      const templatePath = path.join(tmp, "template.txt");
      await writeFile(
        templatePath,
        [
          "// ARBITER:BEGIN A newA // ARBITER:END A",
          "// ARBITER:BEGIN C newC // ARBITER:END C",
        ].join("\n"),
        "utf-8",
      );

      const epic = {
        id: "epic-patch",
        title: "Patch Epic",
        owners: ["alice"],
        targets: [],
        generate: [
          {
            path: targetPath,
            mode: "patch" as const,
            template: templatePath,
            data: {},
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

      const code = await executeCommand({
        epic: epicPath,
        workspace: tmp,
        agentMode: true,
      });

      expect(code).toBe(0);

      const patched = await readFile(targetPath, "utf-8");
      expect(patched).toContain("newA");
      expect(patched).toContain("oldB"); // untouched marker
      expect(patched).toContain("newC"); // appended marker
    });
  });
});
