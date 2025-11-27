import { describe, expect, it } from "bun:test";
import { constrainedOperation, globalConstraintEnforcer } from "../constraints/core";

describe("constraints core", () => {
  it("start/end operation around constrainedOperation", async () => {
    const res = await constrainedOperation("test-op", async () => 42);
    expect(res).toBe(42);
  });

  it("tracks payload size validation via event", () => {
    const opId = globalConstraintEnforcer.startOperation("payload", {});
    globalConstraintEnforcer.validatePayloadSize("abc", opId);
    globalConstraintEnforcer.endOperation(opId);
    // No throw is success
    expect(true).toBe(true);
  });
});
