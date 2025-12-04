import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as core from "@/constraints/core.js";
import * as filesystem from "@/constraints/filesystem.js";
import * as idempotency from "@/constraints/idempotency.js";
import { ConstraintSystem, createConstraintSystem } from "@/constraints/index.js";
import * as sandbox from "@/constraints/sandbox.js";
import * as schema from "@/constraints/schema.js";

const baseConfig: any = {
  apiUrl: "http://localhost",
  timeout: 1000,
  format: "json",
  color: false,
  localMode: true,
  projectDir: process.cwd(),
  projectStructure: {},
};

describe("ConstraintSystem", () => {
  let intervalSpy: ReturnType<typeof spyOn>;
  let sandboxStub: any;
  let restores: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    restores = [];
    intervalSpy = spyOn(globalThis, "setInterval").mockReturnValue(0 as any);
    restores.push(intervalSpy);

    sandboxStub = {
      startOperation: () => "sandbox-op",
      endOperation: () => {},
      getSandboxStatus: () => ({ activeOperations: 0, complianceRate: 100 }),
    };
    restores.push(spyOn(sandbox, "createSandboxValidator").mockReturnValue(sandboxStub));
    restores.push(spyOn(sandbox, "initializeSandboxConfig").mockImplementation(() => {}));

    restores.push(
      spyOn(idempotency, "withIdempotencyValidation").mockImplementation(
        async (_op, _meta, executor) => executor(),
      ),
    );
    restores.push(
      spyOn(idempotency.globalIdempotencyValidator, "getValidationStats").mockReturnValue({
        cacheSize: 2,
        validations: 5,
      }),
    );
    restores.push(
      spyOn(idempotency.globalIdempotencyValidator, "clearExpiredCache").mockImplementation(
        () => {},
      ),
    );

    restores.push(spyOn(core.globalConstraintEnforcer, "startOperation").mockReturnValue("op-1"));
    restores.push(
      spyOn(core.globalConstraintEnforcer, "endOperation").mockImplementation(() => {}),
    );
    restores.push(
      spyOn(core.globalConstraintEnforcer, "validatePayloadSize").mockImplementation(() => {}),
    );
    restores.push(
      spyOn(core.globalConstraintEnforcer, "getConstraintStatus").mockReturnValue({
        constraints: core.DEFAULT_CONSTRAINTS,
        activeOperations: 0,
        rateLimitStatus: { current: 0, limit: 10, windowStart: 0, windowEnd: 10 },
        violations: { total: 1, byType: { maxPayloadSize: 1 } },
      }),
    );

    restores.push(
      spyOn(filesystem.globalFileSystemConstraints, "validatePath").mockResolvedValue(),
    );
    restores.push(spyOn(filesystem.globalFileSystemConstraints, "exportFiles").mockResolvedValue());
    restores.push(
      spyOn(filesystem.globalFileSystemConstraints, "getConstraintStatus").mockReturnValue({
        maxPathLength: 255,
        maxSymlinkDepth: 3,
        allowedExtensions: [],
        violations: { symlinks: 1, pathTraversal: 0, invalidPaths: 2 },
      }),
    );
    restores.push(spyOn(filesystem, "bundleStandalone").mockResolvedValue());

    restores.push(spyOn(schema, "ensureLatestSchema").mockImplementation(() => {}));
    restores.push(
      spyOn(schema, "validateReadData").mockImplementation((data) => ({
        ...data,
        validated: true,
      })),
    );
  });

  afterEach(() => {
    restores.forEach((spy) => spy.mockRestore());
  });

  it("executes with sandbox and idempotency enforcement and validates schema outputs", async () => {
    const cs = new ConstraintSystem(baseConfig);
    const result = await cs.executeWithConstraints(
      "op",
      { sandbox: { command: "test" } as any, idempotent: { opId: "x" } as any },
      async () => ({ apiVersion: "v1", kind: "Thing" }),
    );

    expect(result).toEqual({ apiVersion: "v1", kind: "Thing" });
    expect(sandboxStub.startOperation).toBeDefined();
    expect(schema.ensureLatestSchema).toHaveBeenCalled();
    expect(idempotency.withIdempotencyValidation).toHaveBeenCalled();
  });

  it("exports files with payload validation, filesystem export, and schema compliance", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arb-constraints-export-"));
    const cs = createConstraintSystem(baseConfig);
    const files = { "data.json": JSON.stringify({ apiVersion: "v1", kind: "Obj" }) };

    await cs.exportWithConstraints(files, tmp, "json");

    expect(core.globalConstraintEnforcer.startOperation).toHaveBeenCalledWith(
      "constrained_export",
      expect.any(Object),
    );
    expect(core.globalConstraintEnforcer.validatePayloadSize).toHaveBeenCalled();
    expect(filesystem.globalFileSystemConstraints.exportFiles).toHaveBeenCalledWith(
      files,
      tmp,
      "op-1",
    );
    expect(schema.ensureLatestSchema).toHaveBeenCalled();

    await rm(tmp, { recursive: true, force: true });
  });

  it("bundles files with path validation and standalone bundling", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arb-constraints-bundle-"));
    const cs = createConstraintSystem(baseConfig);

    await cs.bundleWithConstraints([path.join(tmp, "a.txt")], tmp);

    expect(filesystem.globalFileSystemConstraints.validatePath).toHaveBeenCalled();
    expect(filesystem.bundleStandalone).toHaveBeenCalledWith(
      [path.join(tmp, "a.txt")],
      tmp,
      "op-1",
    );

    await rm(tmp, { recursive: true, force: true });
  });

  it("validates API response envelopes through schema validator", () => {
    const cs = new ConstraintSystem(baseConfig);
    const payload = { apiVersion: "v1", kind: "Thing" };
    const result = cs.validateApiResponse(payload, "api-op");

    expect(core.globalConstraintEnforcer.validatePayloadSize).toHaveBeenCalledWith(
      payload,
      "api-op",
    );
    expect(schema.validateReadData).toHaveBeenCalledWith(payload, "api-op");
    expect(result).toEqual({ ...payload, validated: true });
  });

  it("reports system status and compliance details with violations", () => {
    const cs = new ConstraintSystem(baseConfig);
    (cs as any).incrementViolationCount("maxPayloadSize");
    (cs as any).incrementViolationCount("rateLimit");

    const status = cs.getSystemStatus();
    expect(status.violations.totalViolations).toBeGreaterThan(0);
    expect(status.violations.byConstraint).toMatchObject({ maxPayloadSize: 1, rateLimit: 1 });

    const report = cs.generateComplianceReport();
    expect(report).toContain("Violations");
    expect(report).toContain("maxPayloadSize");
  });

  it("shuts down cleanly and clears idempotency cache", async () => {
    const cs = new ConstraintSystem(baseConfig);
    const shutdownSpy = spyOn(cs, "emit");

    await cs.shutdown();

    expect(idempotency.globalIdempotencyValidator.clearExpiredCache).toHaveBeenCalled();
    expect(shutdownSpy).toHaveBeenCalledWith("constraint_system:shutdown");
  });
});
