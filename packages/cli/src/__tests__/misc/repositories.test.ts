import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { ApiClient } from "@/io/api/api-client.js";
import { DEFAULT_PROJECT_STRUCTURE } from "@/io/config/config.js";
import { FragmentRepository } from "@/repositories/fragment-repository.js";
import { ProjectRepository } from "@/repositories/project-repository.js";
import type { CLIConfig } from "@/types.js";

const originalFetch = global.fetch;
const mockFetch = mock();

beforeAll(() => {
  global.fetch = mockFetch as any;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe("Repositories", () => {
  let client: ApiClient;
  let config: CLIConfig;

  beforeEach(() => {
    config = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "json",
      color: true,
      projectDir: "/test",
      projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
    };
    client = new ApiClient(config);
    mockFetch.mockReset();
  });

  describe("ProjectRepository", () => {
    it("fetches project structure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, projectStructure: { servicesDirectory: "services" } }),
      } as Response);

      const repo = new ProjectRepository(client);
      const result = await repo.fetchProjectStructure();

      expect(result.success).toBe(true);
      expect(result.projectStructure?.servicesDirectory).toBe("services");
    });
  });

  describe("FragmentRepository", () => {
    it("lists fragments", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ id: "1", path: "test" }],
      } as Response);

      const repo = new FragmentRepository(client);
      const result = await repo.list();

      expect(result.success).toBe(true);
      expect(result.data?.[0]?.id).toBe("1");
    });

    it("upserts fragment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "frag", success: true }),
      } as Response);

      const repo = new FragmentRepository(client);
      const result = await repo.upsert("project", "path", "content");

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("frag");
    });
  });
});
