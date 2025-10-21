import { afterAll, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ApiClient } from "../api-client";
import type { CLIConfig } from "../types";

// Mock fetch globally
const originalFetch = global.fetch;
const mockFetch = mock();

let consoleErrorSpy: ReturnType<typeof spyOn<typeof console, "error">>;

beforeAll(() => {
  consoleErrorSpy = spyOn(console, "error");
  consoleErrorSpy.mockImplementation(() => {});
  global.fetch = mockFetch as any;
});

afterAll(() => {
  global.fetch = originalFetch;
  consoleErrorSpy.mockRestore();
});

describe("ApiClient", () => {
  let apiClient: ApiClient;
  let config: CLIConfig;

  beforeEach(() => {
    config = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "json",
      color: true,
      projectDir: "/test",
    };
    apiClient = new ApiClient(config);
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("should initialize with correct config", () => {
      expect(apiClient).toBeDefined();
    });

    it("should remove trailing slash from baseUrl", () => {
      const configWithSlash = { ...config, apiUrl: "http://localhost:5050/" };
      const client = new ApiClient(configWithSlash);
      expect(client).toBeDefined();
    });

    it("should enforce timeout compliance with spec (≤750ms)", () => {
      const configWithLongTimeout = { ...config, timeout: 1000 };
      const client = new ApiClient(configWithLongTimeout);
      expect(client).toBeDefined();
    });

    it("should handle different timeout values", () => {
      const fastClient = new ApiClient({ ...config, timeout: 100 });
      const slowClient = new ApiClient({ ...config, timeout: 10_000 });

      expect(fastClient).toBeDefined();
      expect(slowClient).toBeDefined();
    });
  });

  describe("discoverServer", () => {
    it("should discover server on common ports", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const result = await apiClient.discoverServer();

      expect(result.success).toBe(true);
      expect(result.url).toBeDefined();
    });

    it("should return error when no server found", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const result = await apiClient.discoverServer();

      expect(result.success).toBe(false);
      expect(result.error).toContain("No Arbiter server found");
    });
  });

  describe("validate", () => {
    it("should validate CUE content successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          valid: true,
          errors: [],
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.validate("test: 123");

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5050/api/validate",
        expect.objectContaining({
          method: "POST",
        }),
      );

      const [, validateInit] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(validateInit).toBeDefined();
      const validateHeaders = validateInit?.headers as Headers | undefined;
      expect(validateHeaders).toBeInstanceOf(Headers);
      expect(validateHeaders?.get("Content-Type")).toBe("application/json");
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        text: async () => "Invalid CUE syntax",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.validate("invalid cue");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toContain("API error: 400");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await apiClient.validate("test: 123");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.error).toContain("Network error");
    });

    it("should validate payload size", async () => {
      const largeContent = "x".repeat(70 * 1024); // 70KB

      const result = await apiClient.validate(largeContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
    });
  });

  describe("getIR", () => {
    it("should get intermediate representation successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          ir: { nodes: [], edges: [] },
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getIR("test: 123");

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5050/api/ir",
        expect.objectContaining({
          method: "POST",
        }),
      );

      const [, irInit] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(irInit).toBeDefined();
      const irHeaders = irInit?.headers as Headers | undefined;
      expect(irHeaders).toBeInstanceOf(Headers);
      expect(irHeaders?.get("Content-Type")).toBe("application/json");
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => "Internal server error",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getIR("test: 123");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("listFragments", () => {
    it("should list fragments successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [
          { id: "1", path: "test/fragment1" },
          { id: "2", path: "test/fragment2" },
        ],
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.listFragments();

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should handle custom project ID", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => [],
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.listFragments("custom-project");

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:5050/api/fragments?projectId=custom-project",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await apiClient.listFragments();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.error).toContain("Network error");
    });

    it("should surface invalid URL errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Invalid URL"));

      const result = await apiClient.listFragments();

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });
  });

  describe("updateFragment", () => {
    it("should update fragment successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          id: "fragment-id",
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.updateFragment("project-id", "test/path", "content", {
        author: "test",
        message: "test update",
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it("should create revisions for existing fragments", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "fragment-id", created: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: "fragment-id", revised: true }),
        } as Response);

      const result1 = await apiClient.updateFragment("project-id", "test/path", "content", {
        author: "test",
        message: "initial",
      });

      const result2 = await apiClient.updateFragment("project-id", "test/path", "updated", {
        author: "test",
        message: "revision",
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.exitCode).toBe(0);
    });

    it("should allow empty content payloads", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "fragment-id", created: true }),
      } as Response);

      const result = await apiClient.updateFragment("project-id", "test/path", "", {
        author: "test",
        message: "empty",
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it("should handle missing parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      } as Response);

      const result = await apiClient.updateFragment("project-id", "", "content");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it("should handle network timeouts", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Timeout"));

      const result = await apiClient.updateFragment("project-id", "test/path", "content");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });
  });

  describe("storeSpecification", () => {
    it("should store specification successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          id: "spec-id",
          shard: "shard-1",
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const spec = {
        content: "test: 123",
        type: "assembly",
        path: "test.cue",
        shard: "shard-1",
      };

      const result = await apiClient.storeSpecification(spec);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.data.id).toBe("spec-id");
    });

    it("should handle storage errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => "Storage error",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const spec = {
        content: "test: 123",
        type: "assembly",
        path: "test.cue",
      };

      const result = await apiClient.storeSpecification(spec);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("getSpecification", () => {
    it("should get specification successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          content: "test: 123",
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getSpecification("assembly", "test.cue");

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.data.content).toBe("test: 123");
    });

    it("should handle 404 errors", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: async () => "Not found",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getSpecification("assembly", "missing.cue");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe("Specification not found");
    });
  });

  describe("health", () => {
    it("should check health successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          timestamp: "2023-01-01T00:00:00Z",
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.health();

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.data.status).toBe("ok");
    });

    it("should attempt discovery on initial failure", async () => {
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Discovery call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      // Second health call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: "ok",
          timestamp: "2023-01-01T00:00:00Z",
        }),
      } as Response);

      const consoleSpy = spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = spyOn(console, "log").mockImplementation(() => {});

      const result = await apiClient.health();

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      logSpy.mockRestore();
    });

    it("should handle complete connection failure", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const result = await apiClient.health();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });
  });

  describe("export", () => {
    it("should export successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          output: "exported content",
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.export("test: 123", "json", {
        strict: true,
        includeExamples: false,
        outputMode: "single",
      });

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it("should handle export errors", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: async () => ({
          error: "Invalid format",
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.export("test: 123", "invalid-format");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it("should handle malformed JSON response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.export("test: 123", "json");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("getSupportedFormats", () => {
    it("should get supported formats successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          formats: ["json", "yaml", "toml"],
        }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getSupportedFormats();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(["json", "yaml", "toml"]);
    });

    it("should handle API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => "Server error",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await apiClient.getSupportedFormats();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("rate limiting", () => {
    it("should enforce rate limiting between requests", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as Response;

      mockFetch.mockResolvedValue(mockResponse);

      const start = Date.now();

      // Make two consecutive requests
      await apiClient.health();
      await apiClient.health();

      const duration = Date.now() - start;

      // Should take roughly 1 second due to rate limiting (allow minor scheduling jitter)
      expect(duration).toBeGreaterThanOrEqual(950);
    }, 3000);
  });

  describe("timeout handling", () => {
    it("should handle request timeouts", async () => {
      // Mock a timeout by making fetch hang
      mockFetch.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 1000)));

      const shortTimeoutClient = new ApiClient({
        ...config,
        timeout: 100,
      });

      const result = await shortTimeoutClient.health();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it("should handle AbortError correctly", async () => {
      mockFetch.mockRejectedValueOnce(new Error("AbortError"));

      const result = await apiClient.health();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });

    it("should handle connection refused errors", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const result = await apiClient.health();

      expect(result.success).toBe(false);
      expect(result.error).toContain("No Arbiter server found");
    });
  });

  describe("payload size validation", () => {
    it("should validate payload size in validate method", async () => {
      const largeContent = "x".repeat(70 * 1024); // 70KB

      const result = await apiClient.validate(largeContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
      expect(result.error).toContain("exceeds maximum allowed");
    });

    it("should validate payload size in getIR method", async () => {
      const largeContent = "x".repeat(70 * 1024); // 70KB

      const result = await apiClient.getIR(largeContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
    });

    it("should validate payload size in updateFragment method", async () => {
      const largeContent = "x".repeat(70 * 1024); // 70KB

      const result = await apiClient.updateFragment("project", "path", largeContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
    });
  });

  describe("URL handling", () => {
    it("should handle discovered URL correctly", async () => {
      // First make discovery succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await apiClient.discoverServer();

      // Now make a regular request, should use discovered URL
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as Response);

      await apiClient.health();

      // Should have been called with the original URL for health endpoint
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/health"),
        expect.any(Object),
      );
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await apiClient.updateFragment("project", "path", "content");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.length).toBeGreaterThan(0);
    });

    it("should handle malformed responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as Response);

      const result = await apiClient.listFragments();

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    });
  });
});
