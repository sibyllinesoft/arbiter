import { describe, expect, it } from "bun:test";
import { detectSchemaVersion } from "../index.js";

describe("detectSchemaVersion", () => {
  it("always returns app schema version", () => {
    const version = detectSchemaVersion({ product: {} });
    expect(version.version).toBe("app");
    expect(version.detected_from).toBe("metadata");
  });
});
