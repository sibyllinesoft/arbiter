/**
 * @packageDocumentation
 * Infrastructure validation tests for the warnings system.
 *
 * Tests validation logic for infrastructure concerns:
 * - UI completeness validation
 * - Data management validation
 * - Observability validation
 * - Environment configuration validation
 * - API path validation
 * - Performance and scalability testing
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { validateSpecification } from "@/validation/warnings.js";
import { createCompleteValidSpec, createMinimalValidSpec } from "./warnings-fixtures.js";

describe("Validation Warning System - Infrastructure", () => {
  let minimalValidSpec: ReturnType<typeof createMinimalValidSpec>;
  let completeValidSpec: ReturnType<typeof createCompleteValidSpec>;

  beforeEach(() => {
    minimalValidSpec = createMinimalValidSpec();
    completeValidSpec = createCompleteValidSpec();
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
            type: "external",
            workload: "statefulset",
            image: "postgres:13",
            resource: { kind: "database" },
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
            type: "external",
            workload: "statefulset",
            image: "mysql:8",
            resource: { kind: "database" },
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
            type: "internal",
            workload: "deployment",
            language: "typescript",
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
          api: { type: "internal", workload: "deployment", language: "typescript" },
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
          api: { type: "internal", workload: "deployment", language: "typescript" },
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

  describe("API path validation", () => {
    it("warns when paths are not grouped by service", () => {
      const spec = {
        ...minimalValidSpec,
        services: {},
        paths: {
          "/health": {
            get: { summary: "Health check" },
          },
        },
      };
      const result = validateSpecification(spec);
      const warning = result.warnings.find((w) =>
        w.message.includes("Paths should be grouped under the owning service"),
      );
      expect(warning).toBeDefined();
    });

    it("errors when handler references an unknown service", () => {
      const spec = {
        ...minimalValidSpec,
        services: {
          api: {
            type: "internal",
            workload: "deployment",
            language: "typescript",
            endpoints: {
              list: {
                path: "/api",
                methods: ["GET"],
                handler: {
                  type: "endpoint",
                  service: "missing-service",
                  endpoint: "fetch",
                },
              },
            },
          },
        },
      };
      const result = validateSpecification(spec);
      const error = result.errors.find((w) =>
        w.message.includes("Handler references unknown service"),
      );
      expect(error?.path).toBe("services.api.endpoints.list.handler.service");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large specifications efficiently", () => {
      const largeSpec = {
        ...completeValidSpec,
        services: {},
        ui: { routes: [] },
        groups: [],
      };

      // Generate 50 bespoke services (with groups) and 50 prebuilt services (no groups needed)
      for (let i = 0; i < 50; i++) {
        largeSpec.services[`service-${i}`] = {
          type: "internal",
          workload: "deployment",
          language: "typescript",
          ports: [{ name: "http", port: 3000 + i }],
          healthCheck: { path: "/health", port: 3000 + i },
          resources: { limits: { cpu: "1000m", memory: "512Mi" } },
          env: { SERVICE_ID: `service-${i}` },
        };
      }

      // Generate 50 prebuilt services (don't need groups but need language)
      for (let i = 50; i < 100; i++) {
        largeSpec.services[`service-${i}`] = {
          type: "external",
          workload: "deployment",
          language: "javascript", // Add required language field
          image: "nginx:alpine",
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

      // Generate 50 groups with tasks (corresponding to the 50 bespoke services)
      for (let i = 0; i < 50; i++) {
        largeSpec.groups.push({
          id: `group-${i}`,
          name: `Group for service-${i}`, // Include service name so validation passes
          description: `Implementation group for service-${i}`,
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

      // Should still validate correctly (no errors)
      expect(result.hasErrors).toBe(false);
    });
  });
});
