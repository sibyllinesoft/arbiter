import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "../execute/index.js";

async function inTempWorkspace(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-exec-junit-"));
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

describe("executeCommand JUnit success path", () => {
  it("writes junit with zero failures when tests pass", async () => {
    await inTempWorkspace(async (tmp) => {
      const templatePath = path.join(tmp, "tmpl.txt");
      await writeFile(templatePath, "content", "utf-8");

      const epic = {
        id: "epic-junit",
        title: "JUnit Epic",
        owners: ["alice"],
        targets: [],
        generate: [
          {
            path: path.join(tmp, "out", "file.txt"),
            mode: "create" as const,
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
          // This command exits 0 and is expected to exit 0 (pass)
          cli: [{ cmd: 'node -e "process.exit(0)"', expectExit: 0 }],
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

      expect(code).toBe(0);

      const junit = await readFile(path.join(tmp, "junit.xml"), "utf-8");
      expect(junit).toContain('name="Epic.epic-junit"');
      expect(junit).toContain('failures="0"');
    });
  });
});
