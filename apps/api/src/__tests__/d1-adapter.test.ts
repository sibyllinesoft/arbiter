import { describe, expect, it, vi } from "bun:test";

// Mock drizzle-orm/d1 to avoid requiring actual worker bindings
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn((_binding: unknown, opts: any) => ({ schema: opts?.schema || null })),
}));

import { drizzle } from "drizzle-orm/d1";
import { createD1Client } from "../db/adapters/d1";

describe("createD1Client", () => {
  it("wraps the provided binding and schema", () => {
    const binding = { execute: vi.fn() } as any;
    const result = createD1Client({ binding });

    expect(result.driver).toBe("d1");
    expect(result.binding).toBe(binding);
    expect(drizzle).toHaveBeenCalledWith(
      binding,
      expect.objectContaining({ schema: expect.anything() }),
    );
  });
});
