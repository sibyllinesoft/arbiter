import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "../execute/index.js";

async function inTempWorkspace(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-exec-report-"));
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

describe("executeCommand reports and patching", () => {
  it("writes junit/report files and applies marker patches", async () => {
    await inTempWorkspace(async (tmp) => {
      const targetPath = path.join(tmp, "out", "marker.txt");
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, "// ARBITER:BEGIN SECTION old // ARBITER:END SECTION\n", "utf-8");

      const templatePath = path.join(tmp, "template.txt");
      await writeFile(
        templatePath,
        "// ARBITER:BEGIN SECTION new // ARBITER:END SECTION\n",
        "utf-8",
      );

      const epic = {
        id: "epic-report",
        title: "Report Epic",
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
        tests: {
          static: [],
          property: [],
          golden: [],
          // Intentionally failing: expect exit 1 but command exits 0
          cli: [{ cmd: 'node -e "process.exit(0)"', expectExit: 1 }],
        },
        rollout: { steps: [], gates: [] },
        heuristics: { preferSmallPRs: true, maxFilesPerPR: 10 },
      };

      const epicPath = path.join(tmp, "epic.json");
      await writeFile(epicPath, JSON.stringify(epic), "utf-8");

      const code = await executeCommand({
        epic: epicPath,
        workspace: tmp,
        agentMode: true,
        junit: true,
      });

      // Tests fail -> non-zero exit
      expect(code).toBe(1);

      const patched = await readFile(targetPath, "utf-8");
      expect(patched).toContain("new");
      expect(patched).not.toContain("old");

      const report = JSON.parse(await readFile(path.join(tmp, "report.json"), "utf-8"));
      expect(report.kind).toBe("ExecutionReport");
      expect(report.report.failed).toBe(0); // execution writes success statuses

      const junit = await readFile(path.join(tmp, "junit.xml"), "utf-8");
      expect(junit).toContain('<testsuite name="Epic.epic-report"');
      expect(junit).toContain('failures="1"');
    });
  });
});
