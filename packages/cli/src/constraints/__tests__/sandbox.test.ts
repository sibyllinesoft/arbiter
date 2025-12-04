import { describe, expect, it, mock, spyOn } from "bun:test";

import { ConstraintViolationError, globalConstraintEnforcer } from "@/constraints/core.js";
import { REQUIRED_ENDPOINTS, SandboxValidator } from "@/constraints/sandbox.js";

const baseConfig: any = { apiUrl: "https://api", localMode: false };

describe("SandboxValidator", () => {
  it("marks server usage and rejects wrong endpoint", async () => {
    const validator = new SandboxValidator(baseConfig);
    const opId = validator.startOperation("validate");

    const emit = spyOn(globalConstraintEnforcer, "emit").mockImplementation(() => {});
    const validate = spyOn(
      globalConstraintEnforcer,
      "validateSandboxCompliance",
    ).mockImplementation(() => {});

    // Wrong endpoint should throw
    expect(() => validator.markServerEndpointUsage("validate", "/bad/path", opId)).toThrow(
      ConstraintViolationError,
    );

    // Correct endpoint passes
    validator.markServerEndpointUsage("validate", REQUIRED_ENDPOINTS.validate.path, opId);
    expect(validate).toHaveBeenCalledWith("validate", false, opId);
    emit.mockRestore();
    validate.mockRestore();
  });

  it("detects direct execution as violation", () => {
    const validator = new SandboxValidator(baseConfig);
    const opId = validator.startOperation("diff");
    const validate = spyOn(
      globalConstraintEnforcer,
      "validateSandboxCompliance",
    ).mockImplementation(() => {
      throw new ConstraintViolationError("sandboxCompliance", "direct", "server", {});
    });
    expect(() => validator.markDirectExecution("diff", "tool", opId)).toThrow(
      ConstraintViolationError,
    );
    validate.mockRestore();
  });
});
