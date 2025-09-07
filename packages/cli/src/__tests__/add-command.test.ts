/**
 * Basic tests for the new AST-based add command
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs-extra";
import path from "node:path";
import os from "node:os";
import { addCommand } from "../commands/add.js";
import { validateCUE } from "../cue/index.js";
import type { CLIConfig } from "../types.js";

const TEST_DIR = path.join(os.tmpdir(), "arbiter-add-test-output");
const mockCLIConfig: CLIConfig = {
  version: "1.0.0",
  verbosity: "normal",
};

describe("Add Command - AST-Based CUE Manipulation", () => {
  beforeEach(async () => {
    // Clean up test directory
    if (await fs.pathExists(TEST_DIR)) {
      await fs.remove(TEST_DIR);
    }
    await fs.ensureDir(TEST_DIR);

    // Change to test directory
    process.chdir(TEST_DIR);
  });

  afterEach(async () => {
    // Clean up after tests
    if (await fs.pathExists(TEST_DIR)) {
      await fs.remove(TEST_DIR);
    }
  });

  test("should generate valid CUE when adding a basic service", async () => {
    // Add a TypeScript service
    const result = await addCommand(
      "service",
      "api",
      {
        language: "typescript",
        port: 3000,
      },
      mockCLIConfig,
    );

    expect(result).toBe(0);

    // Verify the assembly file was created and contains valid CUE
    expect(await fs.pathExists("arbiter.assembly.cue")).toBe(true);

    const content = await fs.readFile("arbiter.assembly.cue", "utf-8");

    // Validate using CUE tool
    const validationResult = await validateCUE(content);
    expect(validationResult.valid).toBe(true);

    // Verify content structure
    expect(content).toContain("package");
    expect(content).toContain("api:");
    expect(content).toContain('language:        "typescript"');
    expect(content).toContain("port:       3000");
    expect(content).toContain('serviceType:     "bespoke"');
  });

  test("should generate valid CUE when adding multiple services", async () => {
    // Add multiple services
    const services = [
      { name: "frontend", language: "typescript", port: 3000 },
      { name: "api", language: "typescript", port: 3001 },
      { name: "worker", language: "python", port: 8000 },
    ];

    for (const service of services) {
      const result = await addCommand(
        "service",
        service.name,
        {
          language: service.language,
          port: service.port,
        },
        mockCLIConfig,
      );
      expect(result).toBe(0);
    }

    // Verify the assembly file contains all services and is valid CUE
    const content = await fs.readFile("arbiter.assembly.cue", "utf-8");

    // Validate using CUE tool
    const validationResult = await validateCUE(content);
    expect(validationResult.valid).toBe(true);

    // Verify all services are present
    expect(content).toContain("frontend:");
    expect(content).toContain("api:");
    expect(content).toContain("worker:");

    // Verify languages are correct
    expect(content).toContain('language:        "typescript"');
    expect(content).toContain('language:        "python"');

    // Verify ports are correct
    expect(content).toContain("port:       3000");
    expect(content).toContain("port:       3001");
    expect(content).toContain("port:       8000");
  });

  test("should generate valid CUE when adding database with connection", async () => {
    // First add a service
    await addCommand(
      "service",
      "api",
      {
        language: "typescript",
        port: 3000,
      },
      mockCLIConfig,
    );

    // Then add a database attached to the service
    const result = await addCommand(
      "database",
      "postgres",
      {
        attachTo: "api",
        image: "postgres:15",
        port: 5432,
      },
      mockCLIConfig,
    );

    expect(result).toBe(0);

    // Verify the assembly contains both service and database
    const content = await fs.readFile("arbiter.assembly.cue", "utf-8");

    // Validate using CUE tool
    const validationResult = await validateCUE(content);
    expect(validationResult.valid).toBe(true);

    // Verify database was added
    expect(content).toContain("postgres:");
    expect(content).toContain('image:       "postgres:15"');
    expect(content).toContain("port:       5432");

    // Verify connection environment variable was added to API service
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("postgresql://user:password@postgres:5432/postgres");
  });

  test("should handle hyphenated service names correctly", async () => {
    // Add a service with a hyphenated name
    const result = await addCommand(
      "service",
      "auth-service",
      {
        language: "typescript",
        port: 3002,
      },
      mockCLIConfig,
    );

    expect(result).toBe(0);

    // Verify the assembly file contains valid CUE with quoted key
    const content = await fs.readFile("arbiter.assembly.cue", "utf-8");

    // Validate using CUE tool
    const validationResult = await validateCUE(content);
    expect(validationResult.valid).toBe(true);

    // Verify hyphenated name is quoted in CUE
    expect(content).toContain('"auth-service":');
    expect(content).toContain('language:        "typescript"');
    expect(content).toContain("port:       3002");
  });

  test("should add endpoints correctly", async () => {
    // First add a service
    await addCommand(
      "service",
      "api",
      {
        language: "typescript",
        port: 3000,
      },
      mockCLIConfig,
    );

    // Add an endpoint
    const result = await addCommand(
      "endpoint",
      "/users",
      {
        service: "api",
        method: "GET",
        returns: "UserList",
      },
      mockCLIConfig,
    );

    expect(result).toBe(0);

    // Verify the assembly contains the endpoint
    const content = await fs.readFile("arbiter.assembly.cue", "utf-8");

    // Validate using CUE tool
    const validationResult = await validateCUE(content);
    expect(validationResult.valid).toBe(true);

    // Verify endpoint was added to paths
    expect(content).toContain("paths:");
    expect(content).toContain('"/users":');
    expect(content).toContain("get:");
    expect(content).toContain("#/components/schemas/UserList");
  });

  test("should validate CUE syntax and catch errors", async () => {
    // Create an intentionally malformed assembly file
    await fs.writeFile(
      "arbiter.assembly.cue",
      `package test

services: {
  api: {
    language: "typescript"
    port: 3000
    malformed: [
  }
}`,
    );

    // Validation should fail
    const validationResult = await validateCUE(await fs.readFile("arbiter.assembly.cue", "utf-8"));
    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors.length).toBeGreaterThan(0);
  });
});
