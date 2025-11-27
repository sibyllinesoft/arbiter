import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "../execute/index.js";

async function inTempWorkspace(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-exec-cli-"));
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

describe("executeCommand cli test failures", () => {
  it("returns non-zero when a CLI test fails", async () => {
    await inTempWorkspace(async (tmp) => {
      const epic = {
        id: "epic-cli",
        title: "CLI Fail",
        owners: ["alice"],
        targets: [],
        generate: [
          {
            path: path.join(tmp, "out", "demo.txt"),
            mode: "create" as const,
            template: "inline content",
            data: {},
            guards: [] as string[],
          },
        ],
        contracts: { types: [], invariants: [] },
        tests: {
          static: [],
          property: [],
          golden: [],
          cli: [{ cmd: 'node -e "process.exit(0)"', expectExit: 1 }], // exits 0, expect 1 to force failure
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
      });

      expect(code).toBe(1);
    });
  });
});
