/**
 * Debug test to understand what warnings are being generated
 */

import { describe, expect, it } from "bun:test";
import { validateSpecification } from "@/validation/warnings.js";
import type { AppSpec } from "@arbiter/shared";

describe("Debug Spec Warnings", () => {
  it("should debug complete spec warnings", () => {
    const completeValidSpec: any = {
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

    const result = validateSpecification(completeValidSpec);

    console.log("Complete spec validation result:");
    console.log("Has warnings:", result.hasWarnings);
    console.log("Has errors:", result.hasErrors);
    console.log("Warning count:", result.warnings.length);
    console.log(
      "Warnings:",
      result.warnings.map((w) => `${w.category}: ${w.message}`),
    );

    expect(result).toBeDefined();
  });
});
