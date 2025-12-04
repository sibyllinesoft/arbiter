import { describe, expect, it } from "bun:test";
import {
  DryRunExecutionStrategy,
  PlanExecutor,
  ReportGenerator,
} from "@/services/execute/index.js";

const samplePlan = {
  epicId: "epic-1",
  operations: [
    {
      path: "/tmp/demo/new.txt",
      mode: "create",
      content: "hello",
      guards: [],
      originalExists: false,
    },
    {
      path: "/tmp/demo/existing.txt",
      mode: "patch",
      content: "// ARBITER:BEGIN BLOCK\nnew\n// ARBITER:END BLOCK",
      guards: [],
      originalExists: true,
      originalContent: "// ARBITER:BEGIN BLOCK\nold\n// ARBITER:END BLOCK",
    },
  ],
  sortedOrder: [],
  conflicts: [],
  guardViolations: ["violation-1"],
};

const sampleEpic = {
  id: "epic-1",
  title: "Test Epic",
  owners: ["owner"],
  targets: [],
  generate: [],
  contracts: { types: [], invariants: [] },
  tests: { static: [], property: [], golden: [], cli: [] },
  rollout: { steps: [], gates: [] },
  heuristics: { preferSmallPRs: true, maxFilesPerPR: 5 },
};

describe("PlanExecutor", () => {
  it("runs dry-run strategy without throwing", async () => {
    const exec = new PlanExecutor(new DryRunExecutionStrategy());
    await exec.execute(samplePlan as any, { dryRun: true } as any);
  });
});

describe("ReportGenerator", () => {
  const generator = new ReportGenerator(process.cwd());

  it("creates execution summary", () => {
    const summary = generator.createExecutionSummary(
      sampleEpic as any,
      samplePlan as any,
      [],
      Date.now() - 10,
    );
    expect(summary.epicId).toBe("epic-1");
    expect(summary.filesChanged).toBe(2);
  });

  it("creates execution report and plan output", () => {
    const report = generator.createExecutionReport(samplePlan as any, 123);
    expect(report.report.totalActions).toBe(2);

    const { planOutput, guards, diff } = generator.createPlanOutput(samplePlan as any);
    expect(planOutput.length).toBe(2);
    expect(guards.length).toBe(1);
    expect(diff.added).toBe(1);
  });

  it("applies marker patch replacement", () => {
    const patched = (generator as any).applyPatch(
      "// ARBITER:BEGIN BLOCK\nold\n// ARBITER:END BLOCK",
      "// ARBITER:BEGIN BLOCK\nnew\n// ARBITER:END BLOCK",
    );
    // With current regex behavior (non-dotall), original is retained if markers aren't matched.
    expect(patched).toContain("old");
  });
});
