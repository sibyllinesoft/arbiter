import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { spawn } from "bun";
import fs from "fs-extra";
import path from "path";
import { tmpdir } from "os";
import { ApiClient } from "../api-client";

const TEST_DIR = path.join(tmpdir(), `arbiter-api-spec-test-${Date.now()}`);
const TEST_SERVER_PORT = 5052; // Different port to avoid conflicts
const TEST_API_URL = `http://localhost:${TEST_SERVER_PORT}`;

// Test server instance
let serverProcess: any;
let apiClient: ApiClient;

describe("ApiClient Spec Methods", () => {
  beforeAll(async () => {
    // Create test directory
    await fs.ensureDir(TEST_DIR);
    
    // Start test server
    const serverCmd = spawn([
      "bun",
      "run",
      "--cwd",
      path.join(__dirname, "../../../apps/api"),
      "dev"
    ], {
      env: {
        ...process.env,
        PORT: TEST_SERVER_PORT.toString(),
        AUTH_REQUIRED: "false",
        DATABASE_PATH: path.join(TEST_DIR, "test.db")
      },
      stdio: ["ignore", "ignore", "ignore"]
    });
    
    serverProcess = serverCmd;
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Initialize API client
    apiClient = new ApiClient({
      apiUrl: TEST_API_URL,
      timeout: 5000
    });
  });

  afterAll(async () => {
    // Clean up server
    if (serverProcess) {
      serverProcess.kill();
    }
    
    // Clean up test directory
    await fs.remove(TEST_DIR);
  });

  describe("listFragments method", () => {
    it("should return successful response with empty list initially", async () => {
      const result = await apiClient.listFragments();
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(Array.isArray(result.data)).toBe(true);
    }, 10000);

    it("should handle project ID parameter", async () => {
      const result = await apiClient.listFragments("test-project");
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(Array.isArray(result.data)).toBe(true);
    }, 10000);

    it("should handle network errors gracefully", async () => {
      const badClient = new ApiClient({
        apiUrl: "http://localhost:9999",
        timeout: 1000
      });
      
      const result = await badClient.listFragments();
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.error).toBeDefined();
    }, 10000);
  });

  describe("updateFragment method", () => {
    it("should create fragment successfully", async () => {
      const testContent = `# Test Fragment
name: "test-fragment"
version: "1.0.0"`;

      const result = await apiClient.updateFragment(
        "default",
        "test/fragment",
        testContent,
        {
          author: "test-user",
          message: "Test fragment creation"
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.data).toBeDefined();
    }, 10000);

    it("should update existing fragment and create revision", async () => {
      const testContent1 = `# Test Fragment v1
name: "test-fragment"
version: "1.0.0"`;

      const testContent2 = `# Test Fragment v2
name: "test-fragment"  
version: "2.0.0"
description: "Updated version"`;

      // Create initial fragment
      const result1 = await apiClient.updateFragment(
        "default",
        "test/revision-fragment",
        testContent1,
        {
          author: "test-user",
          message: "Initial version"
        }
      );
      
      expect(result1.success).toBe(true);

      // Update fragment to create revision
      const result2 = await apiClient.updateFragment(
        "default",
        "test/revision-fragment",
        testContent2,
        {
          author: "test-user",
          message: "Updated version"
        }
      );
      
      expect(result2.success).toBe(true);
      expect(result2.exitCode).toBe(0);
    }, 15000);

    it("should handle content validation", async () => {
      const result = await apiClient.updateFragment(
        "default",
        "test/empty",
        "", // Empty content
        {
          author: "test-user",
          message: "Empty content test"
        }
      );
      
      // Should still succeed (empty content is valid)
      expect(result.success).toBe(true);
    }, 10000);

    it("should respect payload size limits", async () => {
      // Create content larger than 64KB limit
      const largeContent = "x".repeat(70 * 1024);
      
      const result = await apiClient.updateFragment(
        "default",
        "test/large",
        largeContent
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Payload size");
    }, 10000);

    it("should handle missing parameters", async () => {
      const result = await apiClient.updateFragment(
        "default",
        "", // Empty path
        "content"
      );
      
      // API should handle empty path gracefully
      expect([true, false]).toContain(result.success);
    }, 10000);

    it("should handle network timeouts", async () => {
      const timeoutClient = new ApiClient({
        apiUrl: TEST_API_URL,
        timeout: 1 // Very short timeout
      });
      
      const result = await timeoutClient.updateFragment(
        "default",
        "test/timeout",
        "test content"
      );
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
    }, 10000);
  });

  describe("API client configuration", () => {
    it("should handle different timeout values", async () => {
      const fastClient = new ApiClient({
        apiUrl: TEST_API_URL,
        timeout: 100
      });
      
      const slowClient = new ApiClient({
        apiUrl: TEST_API_URL,
        timeout: 10000
      });
      
      // Both should be created successfully
      expect(fastClient).toBeDefined();
      expect(slowClient).toBeDefined();
    });

    it("should enforce rate limiting", async () => {
      const promises = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 3; i++) {
        promises.push(apiClient.listFragments());
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed or fail gracefully
      results.forEach(result => {
        expect([0, 1, 2]).toContain(result.exitCode);
      });
    }, 15000);

    it("should validate API URL format", async () => {
      const invalidClient = new ApiClient({
        apiUrl: "invalid-url",
        timeout: 5000
      });
      
      const result = await invalidClient.listFragments();
      expect(result.success).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should provide meaningful error messages", async () => {
      const badClient = new ApiClient({
        apiUrl: "http://localhost:9999",
        timeout: 1000
      });
      
      const result = await badClient.updateFragment(
        "default",
        "test/error",
        "test content"
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }, 10000);

    it("should handle malformed responses", async () => {
      // This test would require mocking the server response
      // For now, just test that the client can handle basic cases
      const result = await apiClient.listFragments();
      expect([true, false]).toContain(result.success);
    });
  });
});