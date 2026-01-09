/**
 * @packageDocumentation
 * Domain-specific validation tests for the warnings system.
 *
 * Tests validation logic for business domain concerns:
 * - Testing validation (unit, integration, e2e)
 * - Groups and tasks validation
 * - Service definition validation
 * - Documentation validation
 * - Security validation
 * - Performance validation
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { validateSpecification } from "@/validation/warnings.js";
import { createMinimalValidSpec } from "./warnings-fixtures.js";

describe("Validation Warning System - Domain", () => {
  let minimalValidSpec: ReturnType<typeof createMinimalValidSpec>;

  beforeEach(() => {
    minimalValidSpec = createMinimalValidSpec();
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

  describe("Groups and Tasks Validation", () => {
    it("should warn when source services exist but no groups defined", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "source-service": {
            type: "internal",
            workload: "deployment",
            language: "typescript",
          },
        },
        groups: [],
      };
      const result = validateSpecification(spec);

      const groupWarning = result.warnings.find((w) => w.message.includes("no groups defined"));
      expect(groupWarning).toBeDefined();
    });

    it("should warn when source services exist but no tasks defined", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "source-service": {
            type: "internal",
            workload: "deployment",
            language: "typescript",
          },
        },
        groups: [
          {
            id: "test-group",
            name: "Test Group",
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

    it("should warn when source service has no corresponding group", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "orphan-service": {
            type: "internal",
            workload: "deployment",
            language: "typescript",
          },
        },
        groups: [
          {
            id: "unrelated-group",
            name: "Unrelated Group",
            tasks: [{ id: "task1", name: "Task 1" }],
          },
        ],
      };
      const result = validateSpecification(spec);

      const orphanWarning = result.warnings.find((w) =>
        w.message.includes("has no corresponding group"),
      );
      expect(orphanWarning).toBeDefined();
    });

    it("should not warn for container services without groups", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          nginx: {
            type: "external",
            workload: "deployment",
            image: "nginx:latest",
          },
        },
      };
      const result = validateSpecification(spec);

      const groupWarnings = result.warnings.filter((w) => w.category === "Project Management");
      expect(groupWarnings).toHaveLength(0);
    });
  });

  describe("Service Definition Validation", () => {
    it("should warn when service missing language", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          "no-lang": {
            type: "internal",
            workload: "deployment",
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
});
