import { describe, expect, it, spyOn } from "bun:test";
import { EventEmitter } from "node:events";

import {
  initializeCLIConstraints,
  withConstraintEnforcement,
} from "@/constraints/cli-integration.js";
import { ConstraintViolationError } from "@/constraints/core.js";
import * as constraintIndex from "@/constraints/index.js";
import * as monitoring from "@/constraints/monitoring.js";

describe("CLI constraint integration (light)", () => {
  it("skips initialization when disabled", () => {
    const initSpy = spyOn(constraintIndex, "initializeGlobalConstraintSystem").mockImplementation(
      (() => ({}) as any) as any,
    );

    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    initializeCLIConstraints({} as any, { enableConstraints: false });

    expect(initSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    initSpy.mockRestore();
  });

  it("initializes monitors and records violations without exiting", () => {
    const fakeSystem = new EventEmitter();
    const initSpy = spyOn(constraintIndex, "initializeGlobalConstraintSystem").mockReturnValue(
      fakeSystem as any,
    );
    const recordViolation = spyOn({ recordViolation() {} }, "recordViolation");
    const recordOperation = spyOn({ recordOperation() {} }, "recordOperation");
    const monitor = Object.assign(new EventEmitter(), {
      recordViolation: recordViolation as any,
      recordOperation: recordOperation as any,
      generateReport: () => "report",
      exportData: async () => {},
      cleanup: () => {},
    });
    const monitorSpy = spyOn(monitoring, "createConstraintMonitor").mockReturnValue(monitor as any);

    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    initializeCLIConstraints({} as any, {
      enableConstraints: true,
      showViolations: true,
      exitOnViolation: false,
    });

    // Emit a violation and ensure it is recorded (but no process exit)
    const violation = new ConstraintViolationError("test", "oops", "expected", { actual: 1 });
    fakeSystem.emit("violation", { constraint: "test", violation, timestamp: Date.now() });

    expect(recordViolation).toHaveBeenCalled();

    errorSpy.mockRestore();
    initSpy.mockRestore();
    monitorSpy.mockRestore();
  });

  it("wraps command execution and records success and constraint violations", async () => {
    const monitor = monitoring.globalConstraintMonitor;
    const opSpy = spyOn(monitor, "recordOperation").mockImplementation(() => {});
    const violSpy = spyOn(monitor, "recordViolation").mockImplementation(() => {});

    const wrapped = withConstraintEnforcement(async () => 0);
    const result = await wrapped();
    expect(result).toBe(0);
    expect(opSpy).toHaveBeenCalledWith(expect.any(String), expect.any(Number), true, { args: 0 });

    const failing = withConstraintEnforcement(async () => {
      throw new ConstraintViolationError("rule", "bad", "expected", { actual: "x" });
    });
    const failCode = await failing();
    expect(failCode).toBe(2);
    expect(violSpy).toHaveBeenCalled();

    opSpy.mockRestore();
    violSpy.mockRestore();
  });
});
