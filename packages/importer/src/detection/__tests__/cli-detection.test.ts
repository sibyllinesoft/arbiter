/**
 * Focused tests for CLI detection improvements
 */

import { type DetectionContext, detectArtifactType } from "../artifact-detector";
import {
  calculateCategoryConfidence,
  determineMostLikelyCategory,
  getCategoryExplanation,
} from "../dependency-matrix";

describe("CLI Detection Improvements", () => {
  describe("Strong CLI Indicators", () => {
    it("should detect JavaScript CLI with commander", () => {
      const deps = ["commander"];
      const result = determineMostLikelyCategory(deps, "javascript");

      expect(result.category).toBe("tool");
      expect(result.confidence).toBeGreaterThan(0.8); // commander has weight 0.9
    });

    it("should detect Python CLI with click", () => {
      const deps = ["click"];
      const result = determineMostLikelyCategory(deps, "python");

      expect(result.category).toBe("tool");
      expect(result.confidence).toBeGreaterThan(0.8); // click has weight 0.9
    });

    it("should detect Rust CLI with clap", () => {
      const deps = ["clap"];
      const result = determineMostLikelyCategory(deps, "rust");

      expect(result.category).toBe("tool");
      expect(result.confidence).toBeGreaterThan(0.8); // clap has weight 0.9
    });
  });

  describe("Multi-dependency CLI Detection", () => {
    it("should have higher confidence with multiple CLI dependencies", () => {
      const singleDep = ["commander"];
      const multiDeps = ["commander", "chalk", "inquirer"];

      const singleScore = calculateCategoryConfidence(singleDep, "javascript", "tool");
      const multiScore = calculateCategoryConfidence(multiDeps, "javascript", "tool");

      expect(multiScore).toBeGreaterThan(singleScore);
      expect(multiScore).toBe(1); // Capped at 1.0 but should be higher than single
      expect(singleScore).toBe(0.9); // Commander has weight 0.9
    });
  });

  describe("Enhanced Artifact Detection", () => {
    it("should detect CLI with comprehensive context", () => {
      const context: DetectionContext = {
        language: "javascript",
        dependencies: ["commander", "chalk"],
        scripts: {
          start: "node bin/cli.js",
        },
        filePatterns: ["bin/cli.js"],
        packageConfig: {
          bin: { mycli: "bin/cli.js" },
        },
        sourceAnalysis: {
          hasBinaryExecution: true,
          hasServerPatterns: false,
          hasFrontendPatterns: false,
          hasCliPatterns: true,
          hasDataProcessingPatterns: false,
          hasTestPatterns: false,
          hasBuildPatterns: false,
          hasGamePatterns: false,
          hasMobilePatterns: false,
          hasDesktopPatterns: false,
        },
      };

      const result = detectArtifactType(context);

      expect(result.primaryType).toBe("tool");
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.explanation.length).toBeGreaterThan(0);
    });

    it("should correctly differentiate CLI from web service", () => {
      const cliContext: DetectionContext = {
        language: "javascript",
        dependencies: ["commander", "inquirer"],
        scripts: { start: "node bin/cli.js" },
        filePatterns: ["bin/cli.js"],
        packageConfig: { bin: { tool: "bin/cli.js" } },
      };

      const webContext: DetectionContext = {
        language: "javascript",
        dependencies: ["express", "cors"],
        scripts: { start: "node server.js" },
        filePatterns: ["server.js", "routes/"],
        packageConfig: { private: true },
      };

      const cliResult = detectArtifactType(cliContext);
      const webResult = detectArtifactType(webContext);

      expect(cliResult.primaryType).toBe("tool");
      expect(webResult.primaryType).toBe("web_service");
    });
  });

  describe("Language-specific CLI patterns", () => {
    it("should handle Go CLI dependencies with full paths", () => {
      const deps = ["github.com/spf13/cobra"];
      const result = determineMostLikelyCategory(deps, "go");

      expect(result.category).toBe("tool");
    });

    it("should handle TypeScript CLI with type definitions", () => {
      const deps = ["commander", "@types/node"];
      const result = determineMostLikelyCategory(deps, "typescript");

      expect(result.category).toBe("tool");
    });

    it("should explain CLI detection reasoning", () => {
      const deps = ["commander", "chalk"];
      const explanation = getCategoryExplanation(deps, "javascript", "tool");

      expect(explanation.length).toBeGreaterThan(0);
      expect(explanation.some((line) => line.includes("commander"))).toBe(true);
      expect(explanation.some((line) => line.includes("chalk"))).toBe(true);
    });
  });

  describe("Edge cases and robustness", () => {
    it("should handle empty dependencies gracefully", () => {
      const result = determineMostLikelyCategory([], "javascript");

      expect(result.category).toBe("package");
      expect(result.confidence).toBe(0.1);
    });

    it("should handle mixed signals with reasonable confidence", () => {
      const mixedDeps = ["commander", "express"]; // Both CLI and web
      const result = determineMostLikelyCategory(mixedDeps, "javascript");

      // Should pick one but not be overly confident
      expect(["tool", "web_service"]).toContain(result.category);
      expect(result.confidence).toBeLessThan(1.0);
    });

    it("should handle partial dependency name matches", () => {
      const deps = ["@nestjs/core"]; // Should match nestjs pattern
      const result = determineMostLikelyCategory(deps, "typescript");

      expect(result.category).toBe("web_service");
    });
  });
});
