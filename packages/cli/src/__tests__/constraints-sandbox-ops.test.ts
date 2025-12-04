import { describe, expect, it } from "bun:test";
import { REQUIRED_ENDPOINTS, createSandboxValidator } from "@/constraints/sandbox";

describe("sandbox validator", () => {
  it("starts and ends a sandbox operation", () => {
    const validator = createSandboxValidator({ apiUrl: "http://localhost:5050" } as any);
    const opId = validator.startOperation("validate");
    const endpoint = validator.getEndpointUrl("validate");
    validator.markServerEndpointUsage("validate", endpoint, opId);
    expect(() => validator.endOperation("validate", opId)).not.toThrow();
    expect(opId).toBeDefined();
  });
});
