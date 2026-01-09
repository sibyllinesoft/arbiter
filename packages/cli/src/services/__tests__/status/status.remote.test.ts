import { describe, expect, it, spyOn } from "bun:test";
import { ApiClient } from "@/io/api/api-client.js";
import { statusCommand } from "@/services/status/index.js";

describe("statusCommand (remote mode)", () => {
  it("prints remote status when API succeeds", async () => {
    const payload = {
      status: "healthy",
      lastUpdated: new Date().toISOString(),
      components: [{ type: "service", name: "api", status: "active" }],
      specifications: [{ path: "assembly.cue", valid: true, errors: 0, warnings: 0 }],
      validations: { total: 1, passed: 1, failed: 0, warnings: 0 },
    };

    const getSpy = spyOn(ApiClient.prototype, "getProjectStatus").mockResolvedValue({
      success: true,
      data: payload,
    } as any);

    const logs: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => logs.push(String(m));

    const code = await statusCommand({}, {
      localMode: false,
      format: "json",
      apiUrl: "http://localhost",
      timeout: 1,
      color: false,
      projectDir: process.cwd(),
      projectId: "proj_1",
    } as any);

    console.log = orig;
    getSpy.mockRestore();

    expect(code).toBe(0);
    expect(logs.join("")).toContain('"health": "healthy"');
  });
});
