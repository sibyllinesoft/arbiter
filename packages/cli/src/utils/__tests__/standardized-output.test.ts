/** @packageDocumentation Utility tests */
import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { StandardizedOutputManager } from "@/utils/util/output/standardized-output";
import fs from "fs-extra";

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), "arbiter-out-"));

describe("StandardizedOutputManager", () => {
  it("writes plan file with base fields", async () => {
    const dir = await tmp();
    const manager = new StandardizedOutputManager("cli test", false);

    const planPath = path.join(dir, "plan.json");
    await manager.writePlanFile([{ id: "1", description: "do it" }], [], [], planPath);

    const data = await fs.readJson(planPath);
    expect(data.kind).toBe("Plan");
    expect(data.plan[0].id).toBe("1");
    expect(data.command).toBe("cli test");
    await fs.remove(dir);
  });

  it("writes diff and junit without NDJSON output", async () => {
    const dir = await tmp();
    const manager = new StandardizedOutputManager("cli test", true);

    // diff
    const diffPath = path.join(dir, "diff.txt");
    await manager.writeDiffFile("line1", diffPath);
    const diffContent = await fs.readFile(diffPath, "utf8");
    expect(diffContent).toContain("# Diff Report");
    expect(diffContent).toContain("line1");

    // junit
    const junitPath = path.join(dir, "junit.xml");
    await manager.writeJUnitFile(
      {
        name: "suite",
        tests: 1,
        failures: 0,
        errors: 0,
        time: 0.1,
        testcases: [{ classname: "c", name: "n", time: 0.1 }],
      },
      junitPath,
    );
    const junitContent = await fs.readFile(junitPath, "utf8");
    expect(junitContent).toContain("<testsuite");
    expect(junitContent).toContain('classname="c"');

    // ndjson output removed; emitEvent should be a no-op
    manager.emitEvent({ phase: "run", status: "ok" } as any);
    manager.close();
    expect(await fs.pathExists(path.join(dir, "events.ndjson"))).toBe(false);

    await fs.remove(dir);
  });
});
