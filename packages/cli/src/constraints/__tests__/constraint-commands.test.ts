import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { addConstraintCommands } from "../cli-integration.js";
import * as constraintIndex from "../index.js";
import * as monitoring from "../monitoring.js";

describe("constraint CLI commands", () => {
  function stubSystem() {
    return {
      on: () => {},
      getSystemStatus: () => ({
        isHealthy: true,
        violations: {
          totalViolations: 0,
          complianceRate: 100,
          criticalViolations: [],
          suggestions: [],
        },
        sandbox: { activeOperations: 0, complianceRate: 100 },
        fileSystem: { symlinks: 0, invalidPaths: 0 },
        idempotency: { cacheSize: 0, validations: 0 },
        schema: { latestVersion: "1", deprecatedWarnings: 0 },
        constraints: {
          maxPayloadSize: 1,
          maxOperationTime: 1,
          rateLimit: { requests: 1, windowMs: 1 },
        },
      }),
      generateComplianceReport: () => "report",
    } as any;
  }

  it("outputs status in json and report modes", async () => {
    const system = stubSystem();
    const getSpy = spyOn(constraintIndex, "getGlobalConstraintSystem").mockReturnValue(system);
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const program = new Command();
    addConstraintCommands(program);

    await program.parseAsync(["constraints", "--json"], { from: "user" });
    await program.parseAsync(["constraints", "--report"], { from: "user" });
    await program.parseAsync(["constraints", "--monitoring"], { from: "user" });

    expect(getSpy).toHaveBeenCalled();

    getSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("exports and resets monitoring data", async () => {
    const exportSpy = spyOn(monitoring.globalConstraintMonitor, "exportData").mockResolvedValue();
    const cleanupSpy = spyOn(monitoring.globalConstraintMonitor, "cleanup").mockImplementation(
      () => {},
    );
    const getSpy = spyOn(constraintIndex, "getGlobalConstraintSystem").mockReturnValue(
      stubSystem(),
    );
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const program = new Command();
    addConstraintCommands(program);

    await program.parseAsync(["constraints:export", "-o", "out.json"], { from: "user" });
    await program.parseAsync(["constraints:reset", "--force"], { from: "user" });

    expect(exportSpy).toHaveBeenCalledWith("out.json");
    expect(cleanupSpy).toHaveBeenCalled();

    exportSpy.mockRestore();
    cleanupSpy.mockRestore();
    logSpy.mockRestore();
  });
});
