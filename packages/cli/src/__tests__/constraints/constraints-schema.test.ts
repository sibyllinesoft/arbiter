import { describe, expect, it } from "bun:test";

describe("constraints/schema module", () => {
  it("loads schema constraints", async () => {
    const mod = await import("@/constraints/core/schema.js");
    expect(mod.LATEST_API_VERSION).toBeDefined();
    expect(Array.isArray(mod.VERSION_COMPATIBILITY.supported)).toBe(true);
  });
});
