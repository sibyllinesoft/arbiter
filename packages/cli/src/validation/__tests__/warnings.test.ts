/**
 * Comprehensive test suite for validation warnings system
 *
 * Tests all validation categories, edge cases, and CLI integration
 * Target: >85% coverage with 100% passing, rigorous validation
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { type ValidationResult, formatWarnings, validateSpecification } from "../warnings.js";

describe("Validation Warning System", () => {
  let minimalValidSpec: any;
  let completeValidSpec: any;
  let incompleteSpec: any;

  beforeEach(() => {
    // Minimal but complete spec for baseline testing
    minimalValidSpec = {
      product: {
        name: "Test Product",
        goals: ["Achieve high performance", "Ensure reliability"],
      },
      metadata: {
        name: "test-project",
        version: "1.0.0",
        description: "A comprehensive test project",
      },
      services: {},
      ui: { routes: [] },
      tests: [
        {
          name: "Unit Tests",
          type: "unit",
          cases: [{ name: "test case", assertion: "should work" }],
        },
        {
          name: "Integration Tests",
          type: "integration",
          cases: [{ name: "integration test", assertion: "should integrate" }],
        },
        {
          name: "E2E Tests",
          type: "e2e",
          cases: [{ name: "e2e test", assertion: "should work end-to-end" }],
        },
      ],
      security: {
        authentication: { type: "oauth2" },
        authorization: { rbac: true },
      },
      performance: {
        sla: { responseTime: "< 200ms", availability: "99.9%" },
      },
      observability: {
        logging: { level: "info", format: "json" },
        monitoring: { metrics: ["response_time", "error_rate"] },
      },
      environments: {
        development: { name: "dev" },
        production: { name: "prod" },
      },
    };

    // Complete spec with all possible configurations
    completeValidSpec = {
      ...minimalValidSpec,
      services: {
        "web-app": {
          serviceType: "container",
          image: "nginx:latest",
          language: "javascript", // Add missing language
          type: "deployment",
          ports: [{ name: "http", port: 80, targetPort: 80 }],
          healthCheck: { path: "/health", port: 80 },
          resources: {
            limits: { cpu: "1000m", memory: "512Mi" },
            requests: { cpu: "100m", memory: "128Mi" },
          },
          env: { NODE_ENV: "production" },
        },
        // Remove bespoke service since it needs epics, or add corresponding epic
      },
      ui: {
        routes: [
          {
            id: "dashboard",
            path: "/dashboard",
            capabilities: ["view", "manage"],
            components: ["DashboardHeader", "MetricsPanel"],
            requiresAuth: true,
          },
          {
            id: "admin",
            path: "/admin",
            capabilities: ["admin"],
            components: ["AdminPanel"],
            requiresAuth: true,
          },
        ],
      },
      locators: {
        "dashboard-header": "[data-testid='dashboard-header']",
        "metrics-panel": "[data-testid='metrics-panel']",
      },
      epics: [
        {
          id: "api-implementation",
          name: "Implement API Service",
          description: "Build the core API service",
          priority: "high",
          status: "planning",
          tasks: [
            {
              id: "setup-endpoints",
              name: "Setup API Endpoints",
              type: "feature",
              dependsOn: [],
            },
            {
              id: "add-authentication",
              name: "Add Authentication",
              type: "feature",
              dependsOn: ["setup-endpoints"],
            },
          ],
        },
      ],
      data: {
        models: [{ name: "User", fields: ["id", "email"] }],
        migrations: { strategy: "flyway", version: "1.0" },
      },
      docs: {
        api: { format: "openapi", version: "3.0" },
      },
    };

    // Incomplete spec that should trigger many warnings
    incompleteSpec = {
      product: {
        name: "Incomplete Project",
        // Missing goals
      },
      metadata: {
        name: "incomplete",
        version: "1.0.0",
        // Missing description
      },
      services: {
        "incomplete-api": {
          serviceType: "bespoke", // Source service
          language: "typescript",
          type: "deployment",
          ports: [{ name: "http", port: 3000, targetPort: 3000 }],
          // Missing: healthCheck, resources, env
        },
      },
      ui: {
        routes: [
          {
            id: "incomplete-route",
            path: "/incomplete",
            // Missing: capabilities, components
          },
        ],
      },
      // Missing: tests, epics, security, performance, observability, environments, locators, docs
    };
  });

  describe("Core Validation Function", () => {
    it("should return no warnings for complete valid spec", () => {
      const result = validateSpecification(completeValidSpec);

      console.log("Main test - completeValidSpec warnings:", result.warnings.length);
      if (result.warnings.length > 0) {
        console.log(
          "Warnings:",
          result.warnings.map((w) => `${w.category}: ${w.message}`),
        );
      }

      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should return no warnings for minimal valid spec", () => {
      const result = validateSpecification(minimalValidSpec);

      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should return multiple warnings for incomplete spec", () => {
      const result = validateSpecification(incompleteSpec);

      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(10);
    });

    it("should handle empty spec gracefully", () => {
      const emptySpec = {} as AppSpec;
      const result = validateSpecification(emptySpec);

      expect(result.hasWarnings).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(5);
    });

    it("should handle null/undefined properties gracefully", () => {
      const nullSpec = {
        product: null,
        metadata: undefined,
        services: null,
        ui: undefined,
        tests: null,
      } as any;

      const result = validateSpecification(nullSpec);
      expect(result.hasWarnings).toBe(true);
    });
  });

  describe("Testing Validation", () => {
    it("should warn when no tests are defined", () => {
      const spec = { ...minimalValidSpec, tests: [] };
      const result = validateSpecification(spec);

      const testWarning = result.warnings.find((w) => w.category === "Testing");
      expect(testWarning).toBeDefined();
      expect(testWarning?.message).toContain("No test suites defined");
    });

    it("should warn when missing unit tests", () => {
      const spec = {
        ...minimalValidSpec,
        tests: [
          {
            name: "Integration",
            type: "integration",
            cases: [{ name: "test", assertion: "works" }],
          },
          { name: "E2E", type: "e2e", cases: [{ name: "test", assertion: "works" }] },
        ],
      };
      const result = validateSpecification(spec);

      const unitWarning = result.warnings.find((w) => w.message.includes("Missing unit tests"));
      expect(unitWarning).toBeDefined();
    });

    it("should warn when missing integration tests", () => {
      const spec = {
        ...minimalValidSpec,
        tests: [
          { name: "Unit", type: "unit", cases: [{ name: "test", assertion: "works" }] },
          { name: "E2E", type: "e2e", cases: [{ name: "test", assertion: "works" }] },
        ],
      };
      const result = validateSpecification(spec);

      const integrationWarning = result.warnings.find((w) =>
        w.message.includes("Missing integration tests"),
      );
      expect(integrationWarning).toBeDefined();
    });

    it("should warn when missing e2e tests", () => {
      const spec = {
        ...minimalValidSpec,
        tests: [
          { name: "Unit", type: "unit", cases: [{ name: "test", assertion: "works" }] },
          {
            name: "Integration",
            type: "integration",
            cases: [{ name: "test", assertion: "works" }],
          },
        ],
      };
      const result = validateSpecification(spec);

      const e2eWarning = result.warnings.find((w) =>
        w.message.includes("Missing end-to-end tests"),
      );
      expect(e2eWarning).toBeDefined();
    });

    it("should warn when test suites have no cases", () => {
      const spec = {
        ...minimalValidSpec,
        tests: [{ name: "Empty Test Suite", type: "unit", cases: [] }],
      };
      const result = validateSpecification(spec);

      const emptyTestWarning = result.warnings.find((w) => w.message.includes("has no test cases"));
      expect(emptyTestWarning).toBeDefined();
    });
  });

  describe("Epics and Tasks Validation", () => {
    it("should warn when source services exist but no epics defined", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "source-service": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
          },
        },
        epics: [],
      };
      const result = validateSpecification(spec);

      const epicWarning = result.warnings.find((w) => w.message.includes("no epics defined"));
      expect(epicWarning).toBeDefined();
    });

    it("should warn when source services exist but no tasks defined", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "source-service": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
          },
        },
        epics: [
          {
            id: "test-epic",
            name: "Test Epic",
            tasks: [], // No tasks
          },
        ],
      };
      const result = validateSpecification(spec);

      const taskWarning = result.warnings.find((w) =>
        w.message.includes("no implementation tasks defined"),
      );
      expect(taskWarning).toBeDefined();
    });

    it("should warn when source service has no corresponding epic", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "orphan-service": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
          },
        },
        epics: [
          {
            id: "unrelated-epic",
            name: "Unrelated Epic",
            tasks: [{ id: "task1", name: "Task 1" }],
          },
        ],
      };
      const result = validateSpecification(spec);

      const orphanWarning = result.warnings.find((w) =>
        w.message.includes("has no corresponding epic"),
      );
      expect(orphanWarning).toBeDefined();
    });

    it("should not warn for container services without epics", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          nginx: {
            serviceType: "container",
            image: "nginx:latest",
            type: "deployment",
          },
        },
      };
      const result = validateSpecification(spec);

      const epicWarnings = result.warnings.filter((w) => w.category === "Project Management");
      expect(epicWarnings).toHaveLength(0);
    });
  });

  describe("Service Definition Validation", () => {
    it("should warn when service missing language", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "no-lang": {
            serviceType: "bespoke",
            type: "deployment",
            // Missing language
          },
        },
      };
      const result = validateSpecification(spec);

      const langWarning = result.warnings.find((w) =>
        w.message.includes("missing language specification"),
      );
      expect(langWarning).toBeDefined();
    });

    it("should warn when service missing ports", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "no-ports": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
            // Missing ports
          },
        },
      };
      const result = validateSpecification(spec);

      const portWarning = result.warnings.find((w) =>
        w.message.includes("has no port definitions"),
      );
      expect(portWarning).toBeDefined();
    });

    it("should warn when bespoke service missing health check", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "no-health": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
            ports: [{ name: "http", port: 3000 }],
            // Missing healthCheck
          },
        },
      };
      const result = validateSpecification(spec);

      const healthWarning = result.warnings.find((w) => w.message.includes("missing health check"));
      expect(healthWarning).toBeDefined();
    });

    it("should warn when service missing resources", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "no-resources": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
            ports: [{ name: "http", port: 3000 }],
            // Missing resources
          },
        },
      };
      const result = validateSpecification(spec);

      const resourceWarning = result.warnings.find((w) =>
        w.message.includes("missing resource specifications"),
      );
      expect(resourceWarning).toBeDefined();
    });

    it("should warn when bespoke service missing environment config", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "no-env": {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
            ports: [{ name: "http", port: 3000 }],
            // Missing env
          },
        },
      };
      const result = validateSpecification(spec);

      const envWarning = result.warnings.find((w) =>
        w.message.includes("missing environment configuration"),
      );
      expect(envWarning).toBeDefined();
    });
  });

  describe("Documentation Validation", () => {
    it("should warn when missing product goals", () => {
      const spec = { ...minimalValidSpec };
      spec.product.goals = [];
      const result = validateSpecification(spec);

      const goalWarning = result.warnings.find((w) => w.message.includes("Missing product goals"));
      expect(goalWarning).toBeDefined();
    });

    it("should warn when missing project description", () => {
      const spec = { ...minimalValidSpec };
      spec.metadata.description = undefined;
      const result = validateSpecification(spec);

      const descWarning = result.warnings.find((w) =>
        w.message.includes("Missing project description"),
      );
      expect(descWarning).toBeDefined();
    });

    it("should warn when API services exist but no API docs", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          api: {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
            ports: [{ name: "http", port: 3000 }],
          },
        },
        // Missing docs.api
      };
      const result = validateSpecification(spec);

      const apiDocWarning = result.warnings.find((w) =>
        w.message.includes("no API documentation specified"),
      );
      expect(apiDocWarning).toBeDefined();
    });
  });

  describe("Security Validation", () => {
    it("should warn when admin routes not protected", () => {
      const spec = {
        ...minimalValidSpec,
        ui: {
          routes: [
            {
              id: "admin",
              path: "/admin",
              capabilities: ["admin"],
              // Missing requiresAuth: true
            },
          ],
        },
      };
      const result = validateSpecification(spec);

      const securityWarning = result.warnings.find((w) =>
        w.message.includes("Admin routes found without authentication"),
      );
      expect(securityWarning).toBeDefined();
    });

    it("should warn when missing security configuration", () => {
      const spec = { ...minimalValidSpec };
      spec.security = undefined;
      const result = validateSpecification(spec);

      const secWarning = result.warnings.find((w) =>
        w.message.includes("Missing security configuration"),
      );
      expect(secWarning).toBeDefined();
    });
  });

  describe("Performance Validation", () => {
    it("should warn when missing performance specs", () => {
      const spec = { ...minimalValidSpec };
      spec.performance = undefined;
      const result = validateSpecification(spec);

      const perfWarning = result.warnings.find((w) =>
        w.message.includes("Missing performance specifications"),
      );
      expect(perfWarning).toBeDefined();
    });

    it("should warn when bespoke service missing resource limits", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          api: {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
            ports: [{ name: "http", port: 3000 }],
            resources: {
              requests: { cpu: "100m", memory: "128Mi" },
              // Missing limits
            },
          },
        },
      };
      const result = validateSpecification(spec);

      const limitWarning = result.warnings.find((w) =>
        w.message.includes("missing resource limits"),
      );
      expect(limitWarning).toBeDefined();
    });
  });

  describe("UI Completeness Validation", () => {
    it("should warn when routes missing components", () => {
      const spec = {
        ...minimalValidSpec,
        ui: {
          routes: [
            {
              id: "route1",
              path: "/test",
              // Missing components
            },
          ],
        },
      };
      const result = validateSpecification(spec);

      const compWarning = result.warnings.find((w) =>
        w.message.includes("missing component specifications"),
      );
      expect(compWarning).toBeDefined();
    });

    it("should warn when routes missing capabilities", () => {
      const spec = {
        ...minimalValidSpec,
        ui: {
          routes: [
            {
              id: "route1",
              path: "/test",
              components: ["TestComponent"],
              // Missing capabilities
            },
          ],
        },
      };
      const result = validateSpecification(spec);

      const capWarning = result.warnings.find((w) =>
        w.message.includes("missing capability definitions"),
      );
      expect(capWarning).toBeDefined();
    });

    it("should warn when UI routes exist but no locators", () => {
      const spec = {
        ...minimalValidSpec,
        ui: {
          routes: [
            {
              id: "route1",
              path: "/test",
              components: ["TestComponent"],
              capabilities: ["view"],
            },
          ],
        },
        // Missing locators
      };
      const result = validateSpecification(spec);

      const locatorWarning = result.warnings.find((w) =>
        w.message.includes("no test locators specified"),
      );
      expect(locatorWarning).toBeDefined();
    });
  });

  describe("Data Management Validation", () => {
    it("should warn when database services exist but no data schema", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          postgres: {
            serviceType: "database",
            image: "postgres:13",
            type: "deployment",
            ports: [{ name: "postgres", port: 5432 }],
          },
        },
        // Missing data
      };
      const result = validateSpecification(spec);

      const dataWarning = result.warnings.find((w) => w.message.includes("no data schema defined"));
      expect(dataWarning).toBeDefined();
    });

    it("should warn when database exists but no migration strategy", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          mysql: {
            serviceType: "database",
            image: "mysql:8",
            type: "deployment",
            ports: [{ name: "mysql", port: 3306 }],
          },
        },
        data: {
          models: [{ name: "User", fields: ["id", "name"] }],
          // Missing migrations
        },
      };
      const result = validateSpecification(spec);

      const migrationWarning = result.warnings.find((w) =>
        w.message.includes("no migration strategy defined"),
      );
      expect(migrationWarning).toBeDefined();
    });
  });

  describe("Observability Validation", () => {
    it("should warn when services exist but no observability config", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          api: {
            serviceType: "bespoke",
            language: "typescript",
            type: "deployment",
          },
        },
      };
      spec.observability = undefined;
      const result = validateSpecification(spec);

      const obsWarning = result.warnings.find((w) =>
        w.message.includes("no observability configuration"),
      );
      expect(obsWarning).toBeDefined();
    });

    it("should warn when missing logging configuration", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          api: { serviceType: "bespoke", language: "typescript", type: "deployment" },
        },
        observability: {
          monitoring: { metrics: ["response_time"] },
          // Missing logging
        },
      };
      const result = validateSpecification(spec);

      const logWarning = result.warnings.find((w) =>
        w.message.includes("Missing logging configuration"),
      );
      expect(logWarning).toBeDefined();
    });

    it("should warn when missing monitoring configuration", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          api: { serviceType: "bespoke", language: "typescript", type: "deployment" },
        },
        observability: {
          logging: { level: "info", format: "json" },
          // Missing monitoring
        },
      };
      const result = validateSpecification(spec);

      const monitorWarning = result.warnings.find((w) =>
        w.message.includes("Missing monitoring configuration"),
      );
      expect(monitorWarning).toBeDefined();
    });
  });

  describe("Environment Configuration Validation", () => {
    it("should warn when missing environment configurations", () => {
      const spec = { ...minimalValidSpec };
      spec.environments = undefined;
      const result = validateSpecification(spec);

      const envWarning = result.warnings.find((w) =>
        w.message.includes("Missing environment configurations"),
      );
      expect(envWarning).toBeDefined();
    });

    it("should warn when missing development environment", () => {
      const spec = {
        ...minimalValidSpec,
        environments: {
          production: { name: "prod" },
          // Missing development
        },
      };
      const result = validateSpecification(spec);

      const devWarning = result.warnings.find((w) =>
        w.message.includes("Missing development environment"),
      );
      expect(devWarning).toBeDefined();
    });

    it("should warn when missing production environment", () => {
      const spec = {
        ...minimalValidSpec,
        environments: {
          development: { name: "dev" },
          // Missing production
        },
      };
      const result = validateSpecification(spec);

      const prodWarning = result.warnings.find((w) =>
        w.message.includes("Missing production environment"),
      );
      expect(prodWarning).toBeDefined();
    });
  });

  describe("Format Warnings Function", () => {
    it("should format warnings with colors and structure", () => {
      const result: ValidationResult = {
        hasWarnings: true,
        hasErrors: false,
        warnings: [
          {
            category: "Testing",
            severity: "warning",
            message: "No test suites defined",
            suggestion: "Add comprehensive test coverage",
            path: "tests",
          },
        ],
        errors: [],
      };

      const formatted = formatWarnings(result);

      expect(formatted).toContain("WARNINGS");
      expect(formatted).toContain("Testing:");
      expect(formatted).toContain("No test suites defined");
      expect(formatted).toContain("Add comprehensive test coverage");
      expect(formatted).toContain("Path: tests");
      expect(formatted).toContain("IMPORTANT FOR AI AGENTS");
    });

    it("should format errors with higher priority", () => {
      const result: ValidationResult = {
        hasWarnings: false,
        hasErrors: true,
        warnings: [],
        errors: [
          {
            category: "Critical",
            severity: "error",
            message: "Critical validation error",
            suggestion: "Fix immediately",
          },
        ],
      };

      const formatted = formatWarnings(result);

      expect(formatted).toContain("ERRORS");
      expect(formatted).toContain("Critical validation error");
      expect(formatted).toContain("Fix immediately");
    });

    it("should format both errors and warnings", () => {
      const result: ValidationResult = {
        hasWarnings: true,
        hasErrors: true,
        warnings: [
          {
            category: "Testing",
            severity: "warning",
            message: "Warning message",
            suggestion: "Fix suggestion",
          },
        ],
        errors: [
          {
            category: "Critical",
            severity: "error",
            message: "Error message",
            suggestion: "Error fix",
          },
        ],
      };

      const formatted = formatWarnings(result);

      expect(formatted).toContain("ERRORS");
      expect(formatted).toContain("WARNINGS");
      expect(formatted).toContain("Error message");
      expect(formatted).toContain("Warning message");
    });

    it("should include AI agent prompts when warnings/errors present", () => {
      const result: ValidationResult = {
        hasWarnings: true,
        hasErrors: false,
        warnings: [
          {
            category: "Testing",
            severity: "warning",
            message: "Test warning",
            suggestion: "Fix it",
          },
        ],
        errors: [],
      };

      const formatted = formatWarnings(result);

      expect(formatted).toContain("🚨 IMPORTANT FOR AI AGENTS:");
      expect(formatted).toContain("ASK THE PRODUCT OWNER");
      expect(formatted).toContain("REQUEST APPROVAL");
    });

    it("should not include prompts for clean results", () => {
      const result: ValidationResult = {
        hasWarnings: false,
        hasErrors: false,
        warnings: [],
        errors: [],
      };

      const formatted = formatWarnings(result);

      expect(formatted).toBe("");
    });
  });

  describe("Legacy AssemblyConfig Support", () => {
    it("should convert AssemblyConfig to AppSpec format", () => {
      const legacyConfig = {
        metadata: {
          name: "legacy-project",
          version: "1.0.0",
        },
        services: {
          api: {
            serviceType: "bespoke",
            language: "typescript",
          },
        },
        deployment: {
          target: "kubernetes",
        },
      };

      const result = validateSpecification(legacyConfig as any);

      // Should process without crashing and generate warnings for missing fields
      expect(result).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle deeply nested null values", () => {
      const malformedSpec = {
        product: { name: "Test", goals: null },
        metadata: { name: "test", version: null },
        services: {
          test: {
            serviceType: null,
            language: undefined,
            ports: null,
          },
        },
        ui: { routes: null },
        tests: undefined,
      };

      expect(() => validateSpecification(malformedSpec as any)).not.toThrow();
      const result = validateSpecification(malformedSpec as any);
      expect(result.hasWarnings).toBe(true);
    });

    it("should handle empty arrays and objects", () => {
      const emptySpec = {
        product: { name: "", goals: [] },
        metadata: { name: "", version: "" },
        services: {},
        ui: { routes: [] },
        tests: [],
        epics: [],
        environments: {},
      };

      const result = validateSpecification(emptySpec as any);
      expect(result.hasWarnings).toBe(true);
    });

    it("should handle malformed service configurations", () => {
      const badServiceSpec = {
        ...minimalValidSpec,
        services: {
          "bad-service": {
            // Missing required fields
          },
        },
      };

      expect(() => validateSpecification(badServiceSpec as any)).not.toThrow();
      const result = validateSpecification(badServiceSpec as any);
      expect(result.hasWarnings).toBe(true);
    });

    it("should handle malformed UI route configurations", () => {
      const badUISpec = {
        ...minimalValidSpec,
        ui: {
          routes: [
            {
              // Missing required fields
            },
            {
              id: "",
              path: "",
              capabilities: null,
              components: undefined,
            },
          ],
        },
      };

      expect(() => validateSpecification(badUISpec as any)).not.toThrow();
      const result = validateSpecification(badUISpec as any);
      expect(result.hasWarnings).toBe(true);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large specifications efficiently", () => {
      const largeSpec = {
        ...completeValidSpec,
        services: {},
        ui: { routes: [] },
        epics: [],
      };

      // Generate 50 bespoke services (with epics) and 50 prebuilt services (no epics needed)
      for (let i = 0; i < 50; i++) {
        largeSpec.services[`service-${i}`] = {
          serviceType: "bespoke",
          language: "typescript",
          type: "deployment",
          ports: [{ name: "http", port: 3000 + i }],
          healthCheck: { path: "/health", port: 3000 + i },
          resources: { limits: { cpu: "1000m", memory: "512Mi" } },
          env: { SERVICE_ID: `service-${i}` },
        };
      }

      // Generate 50 prebuilt services (don't need epics but need language)
      for (let i = 50; i < 100; i++) {
        largeSpec.services[`service-${i}`] = {
          serviceType: "prebuilt",
          language: "javascript", // Add required language field
          image: "nginx:alpine",
          type: "deployment",
          ports: [{ name: "http", port: 3000 + i }],
          healthCheck: { path: "/health", port: 3000 + i },
          resources: { limits: { cpu: "1000m", memory: "512Mi" } },
          env: { SERVICE_ID: `service-${i}` },
        };
      }

      // Generate 100 UI routes
      for (let i = 0; i < 100; i++) {
        largeSpec.ui.routes.push({
          id: `route-${i}`,
          path: `/route-${i}`,
          capabilities: ["view"],
          components: [`Component${i}`],
          requiresAuth: false,
        });
      }

      // Generate 50 epics with tasks (corresponding to the 50 bespoke services)
      for (let i = 0; i < 50; i++) {
        largeSpec.epics.push({
          id: `epic-${i}`,
          name: `Epic for service-${i}`, // Include service name so validation passes
          description: `Implementation epic for service-${i}`,
          tasks: [
            {
              id: `task-${i}-1`,
              name: `Task ${i}-1`,
              type: "feature",
            },
            {
              id: `task-${i}-2`,
              name: `Task ${i}-2`,
              type: "feature",
              dependsOn: [`task-${i}-1`],
            },
          ],
        });
      }

      const startTime = performance.now();
      const result = validateSpecification(largeSpec);
      const endTime = performance.now();

      // Should complete within reasonable time (< 200ms)
      expect(endTime - startTime).toBeLessThan(200);

      // Should still validate correctly
      expect(result.hasWarnings).toBe(false);
      expect(result.hasErrors).toBe(false);
    });
  });
});
