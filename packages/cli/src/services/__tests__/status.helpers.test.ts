import { describe, expect, it } from "bun:test";
import { getHealthColor, getHealthIcon, normalizeRemoteProjectStatus } from "../status/index.js";

describe("status helpers", () => {
  it("maps health to colors and icons", () => {
    expect(getHealthIcon("healthy")).toBe("✅");
    expect(getHealthIcon("error")).toBe("❌");
    expect(getHealthColor("degraded")).toBeInstanceOf(Function);
  });

  it("normalizes remote status payloads", () => {
    const status = normalizeRemoteProjectStatus(
      {
        status: "healthy",
        components: [{ type: "service", name: "api", status: "active" }],
        specifications: [{ path: "api.cue", valid: true }],
      },
      "proj",
    );
    expect(status.health).toBe("healthy");
    expect(status.components?.[0].name).toBe("api");
    expect(status.specifications?.[0].path).toBe("api.cue");
  });
});
