import { describe, expect, it } from "bun:test";
import { statusCommand } from "@/services/status/index.js";

/**
 * Stub ApiClient for testing - no global mock pollution
 */
class StubApiClient {
  private statusResponse: any;

  constructor(response?: any) {
    this.statusResponse = response ?? { success: false, error: "down" };
  }

  async getProjectStatus(_projectId?: string) {
    return this.statusResponse;
  }
}

describe("statusCommand remote fallback", () => {
  it("falls back to local status on API error and returns health code", async () => {
    const stubClient = new StubApiClient({ success: false, error: "down" });

    const code = await statusCommand(
      {},
      {
        localMode: false,
        format: "table",
        projectDir: "/tmp/arbiter-no-assembly",
        apiUrl: "http://localhost",
        timeout: 1,
        color: false,
        projectId: "proj",
      } as any,
      stubClient as any,
    );

    expect(code).toBe(1);
  });
});
