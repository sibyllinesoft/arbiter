import { describe, expect, it } from "bun:test";

describe("constraints/sandbox module", () => {
  it("loads sandbox constraints", async () => {
    const mod = await import("@/constraints/sandbox");
    expect(mod).toBeTruthy();
    expect(mod.REQUIRED_ENDPOINTS.validate.path).toBe("/api/v1/validate");
  });
});
