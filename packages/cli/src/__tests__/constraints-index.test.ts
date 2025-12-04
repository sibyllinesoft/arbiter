import { describe, expect, it } from "bun:test";

describe("constraints/index module", () => {
  it("exports constraint bundles without throwing", async () => {
    const mod = await import("@/constraints/index");
    expect(mod).toBeTruthy();
    expect(mod.ConstraintSystem).toBeDefined();
  });
});
