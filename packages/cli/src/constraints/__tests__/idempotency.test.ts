import { describe, expect, it } from "bun:test";
import { validateIdempotentEdits, withIdempotencyValidation } from "@/constraints/idempotency.js";

describe("Idempotency helpers", () => {
  it("validates idempotent edit flow and returns consistent content", async () => {
    const base = { value: 1 };

    const { finalContent, edit } = await validateIdempotentEdits(
      { name: "test-op" } as any,
      base,
      async (content) => ({ delta: content.value + 1 }),
      async (content, e) => ({ value: e.delta }),
    );

    expect(finalContent.value).toBe(2);
    expect(edit.delta).toBe(2);
  });

  it("wraps executor with idempotency validation", async () => {
    const result = await withIdempotencyValidation(
      { name: "noop" } as any,
      { input: 1 },
      async (inputs) => inputs.input + 1,
    );
    expect(result).toBe(2);
  });
});
