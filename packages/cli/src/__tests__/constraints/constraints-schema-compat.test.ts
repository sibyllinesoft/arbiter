import { describe, expect, it } from "bun:test";
import { ensureLatestSchema } from "@/constraints/core/schema.js";

describe("ensureLatestSchema", () => {
  it("throws when apiVersion is too old", () => {
    expect(() => ensureLatestSchema({ apiVersion: "2020-01-01" } as any)).toThrow();
  });
});
