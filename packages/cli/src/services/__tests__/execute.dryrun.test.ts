import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeCommand } from "../execute/index.js";

async function inTempWorkspace(run: (dir: string) => Promise<void>) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-exec-"));
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

const baseEpic = {
  id: "epic-1",
  title: "Demo Epic",
  owners: ["alice"],
  targets: [],
  generate: [
    {
      path: "out/demo.txt",
      mode: "create" as const,
      template: "hello",
      data: {},
      guards: [] as string[],
    },
  ],
  contracts: { types: [], invariants: [] },
  tests: { static: [], property: [], golden: [], cli: [] },
  rollout: { steps: [], gates: [] },
  heuristics: { preferSmallPRs: true, maxFilesPerPR: 10 },
};

describe("executeCommand dry run", () => {
  it("writes plan and diff outputs without applying changes", async () => {
    await inTempWorkspace(async (tmp) => {
      const epicPath = path.join(tmp, "epic.json");
      await writeFile(epicPath, JSON.stringify(baseEpic), "utf-8");

      const code = await executeCommand({
        epic: epicPath,
        workspace: tmp,
        dryRun: true,
        verbose: true,
        agentMode: true,
      });

      expect(code).toBe(0);
      expect(await fileExists(path.join(tmp, "plan.json"))).toBe(true);
      expect(await fileExists(path.join(tmp, "diff.txt"))).toBe(true);
      expect(await fileExists(path.join(tmp, "out", "demo.txt"))).toBe(false);
    });
  });

  it("fails fast when guard violations are present", async () => {
    await inTempWorkspace(async (tmp) => {
      const epicPath = path.join(tmp, "epic.json");
      const guardedEpic = {
        ...baseEpic,
        generate: [
          {
            ...baseEpic.generate[0],
            mode: "patch" as const,
            guards: ["forbidden-token"],
          },
        ],
      };
      // Pre-create the target file containing the forbidden token to trigger violation
      const targetPath = path.join(tmp, "out", "demo.txt");
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, "forbidden-token", "utf-8");

      await writeFile(epicPath, JSON.stringify(guardedEpic), "utf-8");

      const code = await executeCommand({
        epic: epicPath,
        workspace: tmp,
        dryRun: true,
        agentMode: true,
      });

      expect(code).toBe(1);
      expect(await fileExists(path.join(tmp, "plan.json"))).toBe(false);
      expect(await fileExists(path.join(tmp, "diff.txt"))).toBe(false);
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
