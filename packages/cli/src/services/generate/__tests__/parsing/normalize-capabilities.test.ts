import { describe, expect, it } from "bun:test";
import { normalizeCapabilities } from "@/services/generate/io/index.js";

describe("normalizeCapabilities", () => {
  it("returns null for falsy input", () => {
    expect(normalizeCapabilities(undefined)).toBeNull();
  });

  it("converts array of strings/objects into keyed record", () => {
    const result = normalizeCapabilities([
      "auth",
      { name: "payments" },
      { id: "custom-id", name: "id set" },
    ]);

    expect(result?.auth.name).toBe("auth");
    expect(result?.payments.name).toBe("payments");
    expect(result?.["custom-id"].name).toBe("id set");
  });

  it("returns shallow copy when input already object", () => {
    const input = { api: { name: "api" } } as any;
    const result = normalizeCapabilities(input);
    expect(result).not.toBe(input);
    expect(result?.api.name).toBe("api");
  });
});
