import { describe, expect, it } from "bun:test";
import { idempotent, withIdempotencyValidation } from "@/constraints/utils/idempotency.js";

describe("idempotency constraints", () => {
  it("wraps a function with idempotency validation utility", async () => {
    const result = await withIdempotencyValidation("demo-op", [2], async (inputs) => inputs[0] * 2);
    expect(result).toBe(4);
  });

  it("decorator enforces idempotency on methods", async () => {
    class Demo {
      @idempotent("demo-op")
      async run(value: number) {
        return value * 3;
      }
    }

    const demo = new Demo();
    const result = await demo.run(3);
    expect(result).toBe(9);
  });
});
