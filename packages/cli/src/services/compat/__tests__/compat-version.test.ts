import { describe, expect, it } from "bun:test";
import { LATEST_API_VERSION, VERSION_COMPATIBILITY } from "../../../constraints/schema.js";
import { evaluateApiVersion, loadVersionsToCheck } from "../index.js";

describe("compat version helpers", () => {
  it("loadVersionsToCheck injects latest api version when missing", async () => {
    const versions = await loadVersionsToCheck();
    expect(versions.api_version).toBe(LATEST_API_VERSION);
  });

  it("evaluateApiVersion returns undefined for latest version", () => {
    expect(evaluateApiVersion(LATEST_API_VERSION)).toBeUndefined();
  });

  it("evaluateApiVersion warns for supported but outdated version", () => {
    const older = VERSION_COMPATIBILITY.supported.find((v) => v !== LATEST_API_VERSION);
    if (!older) {
      throw new Error("expected supported versions to include older entry");
    }
    const status = evaluateApiVersion(older);
    expect(status).toBeDefined();
    expect(status?.severity).toBe("warning");
  });

  it("evaluateApiVersion errors for unsupported version", () => {
    const unsupported = VERSION_COMPATIBILITY.unsupported[0] ?? "1900-01-01";
    const status = evaluateApiVersion(unsupported);
    expect(status).toBeDefined();
    expect(status?.severity).toBe("error");
  });
});
