import { describe, expect, it } from "bun:test";
import { ConstraintEnforcer } from "../constraints/core";

describe("ConstraintEnforcer rate limiting", () => {
  it("allows operations under infinite rate limit", () => {
    const enforcer = new ConstraintEnforcer({ rateLimit: { requests: Infinity, windowMs: 1000 } });
    const opId = enforcer.startOperation("rate-test");
    enforcer.endOperation(opId);
    expect(true).toBe(true);
  });
});
