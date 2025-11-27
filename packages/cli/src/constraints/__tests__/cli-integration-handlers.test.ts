import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCUEManipulator } from "../../cue/index.js";
import { __cliIntegrationTesting } from "../cli-integration.js";
import { ConstraintViolationError } from "../core.js";
import { globalConstraintMonitor } from "../monitoring.js";

describe("cli constraint integration helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("withConstraintEnforcement", () => {
    it("records successful operations and returns command result", async () => {
      const recordOp = vi
        .spyOn(globalConstraintMonitor, "recordOperation")
        .mockImplementation(() => {});

      const command = vi.fn().mockResolvedValue(0);
      const wrapped = __cliIntegrationTesting.withConstraintEnforcement(command);

      const result = await wrapped("alpha", "bravo");

      expect(result).toBe(0);
      expect(recordOp).toHaveBeenCalledWith(command.name || "command", expect.any(Number), true, {
        args: 2,
      });
    });

    it("captures constraint violations without throwing", async () => {
      const recordViolation = vi
        .spyOn(globalConstraintMonitor, "recordViolation")
        .mockImplementation(() => {});
      vi.spyOn(globalConstraintMonitor, "recordOperation").mockImplementation(() => {});
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const error = new ConstraintViolationError("payload", 20, 10, { hint: "too big" });
      const command = vi.fn().mockRejectedValue(error);
      const wrapped = __cliIntegrationTesting.withConstraintEnforcement(command);

      const result = await wrapped();

      expect(result).toBe(2);
      expect(recordViolation).toHaveBeenCalledWith(
        expect.objectContaining({ constraint: "payload", violation: error }),
      );
      expect(
        consoleError.mock.calls.some((call) => String(call[0]).includes("Constraint Violation")),
      ).toBe(true);
    });
  });

  it("allows swapping the CUE manipulator factory", () => {
    const instance = { id: "custom-manipulator" } as any;
    __cliIntegrationTesting.setCueManipulatorFactory(() => instance);

    expect(__cliIntegrationTesting.getCueManipulator()).toBe(instance);

    // restore default to avoid cross-test pollution
    __cliIntegrationTesting.setCueManipulatorFactory(() => createCUEManipulator());
  });

  describe("setupConstraintEventHandlers", () => {
    let violationHandlers: Array<(event: any) => void>;
    let alertHandlers: Array<(event: any) => void>;
    let constraintSystem: any;
    let monitor: any;

    beforeEach(() => {
      violationHandlers = [];
      alertHandlers = [];
      constraintSystem = new EventEmitter();
      constraintSystem.generateComplianceReport = vi.fn().mockReturnValue("report");
      constraintSystem.shutdown = vi.fn().mockResolvedValue(undefined);
      constraintSystem.on = vi.fn((event: string, handler: any) => {
        if (event === "violation") {
          violationHandlers.push(handler);
        }
        return constraintSystem;
      });

      monitor = new EventEmitter();
      monitor.recordViolation = vi.fn();
      monitor.generateReport = vi.fn().mockReturnValue("monitoring report");
      monitor.exportData = vi.fn().mockResolvedValue(undefined);
      monitor.on = vi.fn((event: string, handler: any) => {
        if (event === "alert") {
          alertHandlers.push(handler);
        }
        return monitor;
      });
    });

    it("records violations and alerts without exiting when configured", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

      __cliIntegrationTesting.setupConstraintEventHandlers(constraintSystem, monitor, {
        showViolations: true,
        exitOnViolation: false,
        complianceReport: false,
      });

      // trigger violation handler
      violationHandlers.forEach((handler) =>
        handler({ constraint: "rate", violation: { message: "too many" } }),
      );

      expect(monitor.recordViolation).toHaveBeenCalledWith(
        expect.objectContaining({ constraint: "rate" }),
      );
      expect(consoleError.mock.calls.some((call) => String(call[0]).includes("⚠️"))).toBe(true);

      // trigger alert handler
      alertHandlers.forEach((handler) =>
        handler({ type: "system_health", message: "degraded", issues: ["latency"] }),
      );
      expect(consoleWarn).toHaveBeenCalled();
    });

    it("emits compliance and shutdown reports via process hooks", async () => {
      const beforeExitListeners = new Set(process.listeners("beforeExit"));
      const sigintListeners = new Set(process.listeners("SIGINT"));
      const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

      __cliIntegrationTesting.setupConstraintEventHandlers(constraintSystem, monitor, {
        showViolations: false,
        exitOnViolation: false,
        complianceReport: true,
      });

      // capture newly added handlers
      const newBeforeExit = process
        .listeners("beforeExit")
        .find((fn) => !beforeExitListeners.has(fn));
      const newSigint = process.listeners("SIGINT").find((fn) => !sigintListeners.has(fn));

      expect(newBeforeExit).toBeTypeOf("function");
      expect(newSigint).toBeTypeOf("function");

      newBeforeExit && (newBeforeExit as any)();
      await (newSigint as any)?.();

      expect(constraintSystem.generateComplianceReport).toHaveBeenCalled();
      expect(monitor.generateReport).toHaveBeenCalled();
      expect(monitor.exportData).toHaveBeenCalledWith("./constraint-data-export.json");
      expect(consoleLog).toHaveBeenCalled();

      // cleanup listeners to avoid leaking between tests
      if (newBeforeExit) process.removeListener("beforeExit", newBeforeExit as any);
      if (newSigint) process.removeListener("SIGINT", newSigint as any);
    });
  });

  it("prints quick status with critical issues and suggestions", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const status = {
      isHealthy: false,
      violations: {
        complianceRate: 75,
        totalViolations: 3,
        criticalViolations: ["one", "two", "three", "four"],
        suggestions: ["fix it", "add tests", "lower latency"],
      },
      sandbox: {
        activeOperations: 2,
        complianceRate: 88,
      },
      constraints: {
        maxPayloadSize: 2048,
        maxOperationTime: 500,
        rateLimit: { requests: 10, windowMs: 1000 },
      },
      schema: { latestVersion: "1.0.0" },
    } as any;

    __cliIntegrationTesting.showQuickStatus(status);

    expect(log).toHaveBeenCalled();
    expect(__cliIntegrationTesting.formatBytes(2048)).toBe("2 KB");
  });
});
