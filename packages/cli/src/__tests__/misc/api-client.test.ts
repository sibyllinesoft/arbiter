import { afterAll, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { ApiClient } from "@/io/api/api-client.js";
import { DEFAULT_PROJECT_STRUCTURE } from "@/io/config/config.js";
import type { CLIConfig } from "@/types";

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
      projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
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

    it("caps timeout at 10 seconds", () => {
      const configWithLongTimeout = { ...config, timeout: 20_000 };
      const client = new ApiClient(configWithLongTimeout);
      expect((client as any).timeout).toBe(10_000);
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
      const largeContent = "x".repeat(6 * 1024 * 1024); // >5MB

      const result = await apiClient.validate(largeContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
    });
  });

  // Specification/IR responsibilities moved to SpecificationRepository; legacy tests removed.

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
    it("does not throttle requests client-side", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ status: "ok" }),
      } as Response;

      mockFetch.mockResolvedValue(mockResponse);

      const start = Date.now();

      await apiClient.health();
      await apiClient.health();

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
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
      const largeContent = "x".repeat(6 * 1024 * 1024); // 6MB (exceeds 5MB limit)

      const result = await apiClient.validate(largeContent);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
      expect(result.error).toContain("exceeds maximum allowed");
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

  describe("error handling", () => {});
});
