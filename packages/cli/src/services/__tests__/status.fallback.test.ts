import { describe, expect, it, spyOn } from "bun:test";
import { ApiClient } from "../../api-client.js";
import { statusCommand } from "../status/index.js";

describe("statusCommand remote fallback", () => {
  it("falls back to local status on API error and returns health code", async () => {
    const apiSpy = spyOn(ApiClient.prototype, "getProjectStatus").mockResolvedValue({
      success: false,
      error: "down",
    } as any);

    const code = await statusCommand({}, {
      localMode: false,
      format: "table",
      projectDir: "/tmp/arbiter-no-assembly",
      apiUrl: "http://localhost",
      timeout: 1,
      color: false,
      projectId: "proj",
    } as any);

    apiSpy.mockRestore();
    expect(code).toBe(1);
  });
});
