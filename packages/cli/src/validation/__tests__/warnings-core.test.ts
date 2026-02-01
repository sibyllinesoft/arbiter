/**
 * @packageDocumentation
 * Core validation function tests for the warnings system.
 *
 * Tests the fundamental validation logic including:
 * - Complete and minimal spec validation
 * - Empty/null spec handling
 * - Format warnings output
 * - Edge cases and error handling
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  type ValidationResult,
  formatWarnings,
  validateSpecification,
} from "@/validation/warnings.js";
import type { AppSpec } from "@arbiter/shared";
import {
  createCompleteValidSpec,
  createIncompleteSpec,
  createMinimalValidSpec,
} from "./warnings-fixtures.js";

describe("Validation Warning System - Core", () => {
  let minimalValidSpec: ReturnType<typeof createMinimalValidSpec>;
  let completeValidSpec: ReturnType<typeof createCompleteValidSpec>;
  let incompleteSpec: ReturnType<typeof createIncompleteSpec>;

  beforeEach(() => {
    minimalValidSpec = createMinimalValidSpec();
    completeValidSpec = createCompleteValidSpec();
    incompleteSpec = createIncompleteSpec();
  });

  describe("Core Validation Function", () => {
    it("should return no errors for complete valid spec", () => {
      const result = validateSpecification(completeValidSpec);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      // Note: warnings may be present for optional improvements
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

  describe("Edge Cases and Error Handling", () => {
    it("should handle deeply nested null values", () => {
      const malformedSpec = {
        product: { name: "Test", goals: null },
        metadata: { name: "test", version: null },
        services: {
          test: {
            type: null,
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
        groups: [],
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
});
