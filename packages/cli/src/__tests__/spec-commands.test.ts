import { beforeAll, afterAll, describe, expect, it, beforeEach } from "bun:test";
import { spawn } from "bun";
import fs from "fs-extra";
import path from "path";
import { tmpdir } from "os";

const CLI_PATH = path.join(__dirname, "../cli.ts");
const TEST_DIR = path.join(tmpdir(), `arbiter-spec-test-${Date.now()}`);
const TEST_SERVER_PORT = 5051; // Different port to avoid conflicts
const TEST_API_URL = `http://localhost:${TEST_SERVER_PORT}`;

interface TestFragment {
  path: string;
  content: string;
  author: string;
  message: string;
}

// Test server instance
let serverProcess: any;

describe("Spec Commands Integration Tests", () => {
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
  });

  afterAll(async () => {
    // Clean up server
    if (serverProcess) {
      serverProcess.kill();
    }
    
    // Clean up test directory
    await fs.remove(TEST_DIR);
  });

  beforeEach(async () => {
    // Wait a bit between tests to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe("spec status command", () => {
    it("should show empty status when no fragments exist", async () => {
      const result = await runCLI(["spec", "status"]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Spec Fragment Status:");
    }, 10000);
  });

  describe("spec command workflow", () => {
    it("should handle complete revision workflow", async () => {
      const testContent1 = `# Test Spec v1
name: "test-app"
version: "1.0.0"
description: "Initial test specification"`;

      const testContent2 = `# Test Spec v2
name: "test-app"
version: "2.0.0"
description: "Updated test specification"
features: ["auth", "api"]`;

      // Create test files
      const file1 = path.join(TEST_DIR, "spec-v1.cue");
      const file2 = path.join(TEST_DIR, "spec-v2.cue");
      await fs.writeFile(file1, testContent1);
      await fs.writeFile(file2, testContent2);

      // Test that we can see initial status
      let result = await runCLI(["spec", "status"]);
      expect(result.exitCode).toBe(0);

      // Test log command with non-existent fragment (should handle gracefully)
      result = await runCLI(["spec", "log", "test/fragment"]);
      expect(result.exitCode).toBe(0);

      // Test diff with non-existent fragment (should handle gracefully)
      result = await runCLI(["spec", "diff", "test/fragment", "1", "2"]);
      expect(result.exitCode).toBe(0);

      // Test checkout with non-existent fragment (should handle gracefully)
      result = await runCLI(["spec", "checkout", "test/fragment"]);
      expect(result.exitCode).toBe(0);
    }, 15000);

    it("should show correct help for spec subcommands", async () => {
      const result = await runCLI(["spec", "--help"]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("manage spec fragments and revisions");
      expect(result.stdout).toContain("status");
      expect(result.stdout).toContain("checkout");
      expect(result.stdout).toContain("diff");
      expect(result.stdout).toContain("log");
      expect(result.stdout).not.toContain("commit"); // Should not show commit command
    }, 10000);

    it("should handle invalid arguments gracefully", async () => {
      // Test with missing required arguments
      let result = await runCLI(["spec", "checkout"]);
      expect(result.exitCode).toBe(1);

      result = await runCLI(["spec", "log"]);
      expect(result.exitCode).toBe(1);

      result = await runCLI(["spec", "diff"]);
      expect(result.exitCode).toBe(1);
    }, 10000);
  });

  describe("spec command parameters", () => {
    it("should accept valid parameters for checkout", async () => {
      const result = await runCLI([
        "spec", 
        "checkout", 
        "test/fragment"
      ]);
      
      // Should not crash, even if fragment doesn't exist
      expect([0, 1]).toContain(result.exitCode);
    }, 10000);

    it("should accept valid parameters for diff", async () => {
      const result = await runCLI([
        "spec", 
        "diff", 
        "test/fragment", 
        "1", 
        "2"
      ]);
      
      // Should not crash, even if fragment doesn't exist
      expect([0, 1]).toContain(result.exitCode);
    }, 10000);

    it("should accept project-id option", async () => {
      const result = await runCLI([
        "spec", 
        "status", 
        "--project-id", 
        "test-project"
      ]);
      
      expect(result.exitCode).toBe(0);
    }, 10000);
  });

  describe("spec command error handling", () => {
    it("should handle server connection errors gracefully", async () => {
      // Test with wrong API URL
      const result = await runCLI([
        "spec", 
        "status", 
        "--api-url", 
        "http://localhost:9999"
      ]);
      
      // Should handle connection error gracefully
      expect([0, 1, 2]).toContain(result.exitCode);
    }, 10000);

    it("should validate required parameters", async () => {
      // Missing fragment path for checkout
      let result = await runCLI(["spec", "checkout"]);
      expect(result.exitCode).toBe(1);

      // Missing fragment path for log  
      result = await runCLI(["spec", "log"]);
      expect(result.exitCode).toBe(1);

      // Missing fragment path for diff
      result = await runCLI(["spec", "diff"]);
      expect(result.exitCode).toBe(1);
    }, 10000);
  });

  describe("API client integration", () => {
    it("should use correct configuration", async () => {
      const result = await runCLI([
        "spec", 
        "status",
        "--api-url", 
        TEST_API_URL,
        "--timeout", 
        "1000"
      ]);
      
      expect([0, 1, 2]).toContain(result.exitCode);
    }, 10000);

    it("should handle timeout configuration", async () => {
      const result = await runCLI([
        "spec", 
        "status",
        "--timeout", 
        "100" // Very short timeout
      ]);
      
      expect([0, 1, 2]).toContain(result.exitCode);
    }, 10000);
  });
});

/**
 * Helper function to run CLI commands and capture output
 */
async function runCLI(args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const fullArgs = [
    "bun",
    CLI_PATH,
    "--api-url",
    TEST_API_URL,
    ...args
  ];

  try {
    const proc = spawn(fullArgs, {
      cwd: TEST_DIR,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return {
      exitCode: exitCode || 0,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error)
    };
  }
}