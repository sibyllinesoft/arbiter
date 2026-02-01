import { describe, expect, it } from "bun:test";
import { statusCommand } from "@/services/status/index.js";

/**
 * Stub ApiClient for testing - no global mock pollution
 */
class StubApiClient {
  private statusResponse: any;

  constructor(response?: any) {
    this.statusResponse = response ?? {
      success: true,
      data: {
        status: "healthy",
        lastUpdated: new Date().toISOString(),
        components: [{ type: "service", name: "api", status: "active" }],
        specifications: [{ path: "assembly.cue", valid: true, errors: 0, warnings: 0 }],
        validations: { total: 1, passed: 1, failed: 0, warnings: 0 },
      },
    };
  }

  setResponse(response: any) {
    this.statusResponse = response;
    return this;
  }

  async getProjectStatus(_projectId?: string) {
    return this.statusResponse;
  }
}

describe("statusCommand (remote mode)", () => {
  it("prints remote status when API succeeds", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => logs.push(String(m));

    const stubClient = new StubApiClient();

    const code = await statusCommand(
      {},
      {
        localMode: false,
        format: "json",
        apiUrl: "http://localhost",
        timeout: 1,
        color: false,
        projectDir: process.cwd(),
        projectId: "proj_1",
      } as any,
      stubClient as any,
    );

    console.log = orig;

    expect(code).toBe(0);
    expect(logs.join("")).toContain('"health": "healthy"');
  });
});
