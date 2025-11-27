import { describe, expect, it } from "bun:test";
import { ensureLatestSchema } from "../constraints/schema";

describe("ensureLatestSchema", () => {
  it("throws when apiVersion is too old", () => {
    expect(() => ensureLatestSchema({ apiVersion: "2020-01-01" } as any)).toThrow();
  });
});
