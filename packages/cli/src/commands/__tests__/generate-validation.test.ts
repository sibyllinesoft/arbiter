/**
 * Integration tests for generate command validation
 * 
 * Tests CLI behavior with validation warnings and --force flag
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "fs-extra";
import path from "node:path";
import { generateCommand, type GenerateOptions } from "../generate.js";
import type { CLIConfig, Config } from "../../types.js";

describe("Generate Command Validation Integration", () => {
  const testDir = path.join(process.cwd(), "tmp", "generate-validation-test");
  const arbiterDir = path.join(testDir, ".arbiter");
  const assemblyPath = path.join(arbiterDir, "assembly.cue");
  
  let mockConfig: Config & CLIConfig;

  beforeEach(async () => {
    // Clean up and create test directory
    await fs.ensureDir(testDir);
    await fs.ensureDir(arbiterDir);
    
    // Change to test directory
    process.chdir(testDir);
    
    mockConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5000,
      format: "json",
      color: false,
      projectDir: testDir
    } as Config & CLIConfig;
  });

  afterEach(async () => {
    // Clean up test directory
    process.chdir(path.resolve(testDir, "../../../"));
    await fs.remove(testDir);
  });

  describe("Validation Blocking Behavior", () => {
    it("should block generation when warnings are present", async () => {
      // Create incomplete spec
      const incompleteSpec = `package testproject

{
  product: {
    name: "Test Project"
    // Missing goals - should trigger warning
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
    // Missing description - should trigger warning
  }
  services: {
    api: {
      serviceType: "bespoke"  // Source service
      language: "typescript"
      type: "deployment"
      ports: [{
        name: "http"
        port: 3000
        targetPort: 3000
      }]
      // Missing health check, resources, env - should trigger warnings
    }
  }
  ui: {
    routes: [{
      id: "dashboard"
      path: "/"
      // Missing capabilities and components - should trigger warnings
    }]
  }
  // Missing tests, epics, security, performance, etc. - should trigger warnings
}`;

      await fs.writeFile(assemblyPath, incompleteSpec);

      const options: GenerateOptions = {
        outputDir: testDir,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should return 1 (error) due to validation warnings
      expect(exitCode).toBe(1);
    });

    it("should allow generation with --force flag despite warnings", async () => {
      // Create incomplete spec  
      const incompleteSpec = `package testproject

{
  product: {
    name: "Test Project"
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
  }
  services: {
    api: {
      serviceType: "bespoke"
      language: "typescript"
      type: "deployment"
      ports: [{
        name: "http"
        port: 3000
        targetPort: 3000
      }]
    }
  }
  ui: {
    routes: []
  }
}`;

      await fs.writeFile(assemblyPath, incompleteSpec);

      const options: GenerateOptions = {
        outputDir: testDir,
        force: true,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should return 0 (success) with --force despite warnings
      expect(exitCode).toBe(0);
    });

    it("should generate without warnings for complete spec", async () => {
      // Create complete spec
      const completeSpec = `package testproject

{
  product: {
    name: "Test Project",
    goals: [
      "Achieve high performance",
      "Ensure reliability"
    ]
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
    description: "A comprehensive test project"
  },
  services: {},
  ui: { routes: [] },
  tests: [
    {
      name: "Unit Tests",
      type: "unit",
      cases: [{ name: "test case", assertion: "should work" }]
    },
    {
      name: "Integration Tests",
      type: "integration",
      cases: [{ name: "integration test", assertion: "should integrate" }]
    },
    {
      name: "E2E Tests",
      type: "e2e",
      cases: [{ name: "e2e test", assertion: "should work end-to-end" }]
    }
  ],
  security: {
    authentication: { type: "oauth2" }
    authorization: { rbac: true }
  }
  performance: {
    sla: { responseTime: "< 200ms", availability: "99.9%" }
  },
  observability: {
    logging: { level: "info", format: "json" }
    monitoring: { metrics: ["response_time", "error_rate"] }
  },
  environments: {
    development: { name: "dev" },
    production: { name: "prod" }
  }
}`;

      await fs.writeFile(assemblyPath, completeSpec);

      const options: GenerateOptions = {
        outputDir: testDir,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should return 0 (success) with no warnings
      expect(exitCode).toBe(0);
    });
  });

  describe("Output Validation", () => {
    it("should output validation warnings to console", async () => {
      const incompleteSpec = `package testproject

{
  product: {
    name: "Test Project"
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
  }
  services: {
    api: {
      serviceType: "bespoke"
      language: "typescript"
      type: "deployment"
    }
  }
}`;

      await fs.writeFile(assemblyPath, incompleteSpec);

      // Capture console output
      const originalLog = console.log;
      const originalError = console.error;
      const logs: string[] = [];
      const errors: string[] = [];
      
      console.log = (...args) => logs.push(args.join(' '));
      console.error = (...args) => errors.push(args.join(' '));

      try {
        const options: GenerateOptions = { outputDir: testDir, verbose: false };
        await generateCommand(options, mockConfig);
        
        const allOutput = [...logs, ...errors].join('\n');
        
        // Should contain validation messages
        expect(allOutput).toContain("Validating specification completeness");
        expect(allOutput).toContain("WARNINGS");
        expect(allOutput).toContain("Cannot generate with warnings present");
        expect(allOutput).toContain("IMPORTANT FOR AI AGENTS");
        expect(allOutput).toContain("ASK THE PRODUCT OWNER");
        
      } finally {
        console.log = originalLog;
        console.error = originalError;
      }
    });

    it("should show AI agent reminder when using --force", async () => {
      const incompleteSpec = `package testproject

{
  product: {
    name: "Test Project"
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
  }
  services: {
    api: {
      serviceType: "bespoke"
      language: "typescript"
      type: "deployment"
    }
  }
}`;

      await fs.writeFile(assemblyPath, incompleteSpec);

      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => logs.push(args.join(' '));

      try {
        const options: GenerateOptions = { 
          outputDir: testDir, 
          force: true, 
          verbose: false 
        };
        await generateCommand(options, mockConfig);
        
        const allOutput = logs.join('\n');
        
        // Should contain force warning messages
        expect(allOutput).toContain("Generating despite warnings (--force used)");
        expect(allOutput).toContain("REMINDER FOR AI AGENTS");
        expect(allOutput).toContain("requested user approval");
        
      } finally {
        console.log = originalLog;
      }
    });

    it("should show success message for clean specs", async () => {
      const completeSpec = `package testproject

{
  product: {
    name: "Test Project",
    goals: ["Achieve high performance", "Ensure reliability"]
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
    description: "A comprehensive test project"
  },
  services: {},
  ui: { routes: [] },
  tests: [
    {
      name: "Unit Tests",
      type: "unit",
      cases: [{ name: "test", assertion: "works" }]
    },
    {
      name: "Integration Tests",
      type: "integration",
      cases: [{ name: "test", assertion: "works" }]
    },
    {
      name: "E2E Tests",
      type: "e2e",
      cases: [{ name: "test", assertion: "works" }]
    }
  ],
  security: { 
    authentication: { type: "oauth2" },
    authorization: { rbac: true }
  },
  performance: { 
    sla: { responseTime: "< 200ms", availability: "99.9%" }
  },
  observability: {
    logging: { level: "info", format: "json" },
    monitoring: { metrics: ["response_time", "error_rate"] }
  },
  environments: {
    development: { name: "dev" },
    production: { name: "prod" }
  }
}`;

      await fs.writeFile(assemblyPath, completeSpec);

      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => logs.push(args.join(' '));

      try {
        const options: GenerateOptions = { outputDir: testDir, verbose: false };
        await generateCommand(options, mockConfig);
        
        const allOutput = logs.join('\n');
        
        // Should contain success message
        expect(allOutput).toContain("Specification validation passed");
        expect(allOutput).not.toContain("WARNINGS");
        expect(allOutput).not.toContain("AI AGENTS");
        
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe("Dry Run Validation", () => {
    it("should validate even in dry run mode", async () => {
      const incompleteSpec = `package testproject

{
  product: {
    name: "Test Project"  
  }
  metadata: {
    name: "test-project",
    version: "1.0.0",
  }
  services: {
    api: {
      serviceType: "bespoke"
      language: "typescript"
      type: "deployment"
    }
  }
}`;

      await fs.writeFile(assemblyPath, incompleteSpec);

      const options: GenerateOptions = {
        outputDir: testDir,
        dryRun: true,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should still block on validation even in dry run
      expect(exitCode).toBe(1);
    });
  });

  describe("Verbose Mode Integration", () => {
    it("should show validation details in verbose mode", async () => {
      const incompleteSpec = `package testproject

{
  product: {
    name: "Test Project"
  }
  metadata: {
    name: "test-project"  
    version: "1.0.0"
  }
  services: {
    api: {
      serviceType: "bespoke"
      language: "typescript"
      type: "deployment"
    }
  }
}`;

      await fs.writeFile(assemblyPath, incompleteSpec);

      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args) => logs.push(args.join(' '));

      try {
        const options: GenerateOptions = { 
          outputDir: testDir, 
          verbose: true 
        };
        await generateCommand(options, mockConfig);
        
        const allOutput = logs.join('\n');
        
        // Should contain verbose assembly configuration output
        expect(allOutput).toContain("Assembly configuration:");
        expect(allOutput).toContain("Schema version:");
        expect(allOutput).toContain("Validating specification completeness");
        
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle missing assembly file gracefully", async () => {
      // Don't create assembly file
      
      const options: GenerateOptions = {
        outputDir: testDir,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should return 1 (error) for missing file
      expect(exitCode).toBe(1);
    });

    it("should handle malformed CUE gracefully", async () => {
      const malformedSpec = `package testproject

{
  product: {
    name: "Test Project"
    // Missing closing brace
  metadata: {
    name: "test"
    version: "1.0.0"
  }
}`;

      await fs.writeFile(assemblyPath, malformedSpec);

      const options: GenerateOptions = {
        outputDir: testDir,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should return 1 (error) for malformed CUE
      expect(exitCode).toBe(1);
    });
  });

  describe("Multiple Validation Scenarios", () => {
    it("should handle complex nested service configurations", async () => {
      const complexSpec = `package testproject

{
  product: {
    name: "Complex Project"
  }
  metadata: {
    name: "complex-project"
    version: "1.0.0" 
  }
  services: {
    "frontend": {
      serviceType: "container"
      image: "nginx:latest"
      type: "deployment"
      ports: [{ name: "http", port: 80 }]
    }
    "backend": {
      serviceType: "bespoke"
      language: "typescript"
      type: "deployment"
      ports: [{ name: "api", port: 3000 }]
      // Missing health check, resources, env
    }
    "database": {
      serviceType: "database"
      image: "postgres:13"
      type: "deployment"
      ports: [{ name: "postgres", port: 5432 }]
    }
  }
  ui: {
    routes: [
      {
        id: "home"
        path: "/"
        // Missing components and capabilities
      }
      {
        id: "admin"
        path: "/admin"
        capabilities: ["admin"]
        // Missing requiresAuth and components
      }
    ]
  }
}`;

      await fs.writeFile(assemblyPath, complexSpec);

      const options: GenerateOptions = {
        outputDir: testDir,
        verbose: false
      };

      const exitCode = await generateCommand(options, mockConfig);
      
      // Should return 1 due to various warnings
      expect(exitCode).toBe(1);
    });
  });
});