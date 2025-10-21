/**
 * Tests for the Artifact Detector Engine
 */

import { ArtifactDetector, type DetectionContext, detectArtifactType } from "../artifact-detector";

describe("ArtifactDetector", () => {
  describe("CLI Detection Integration", () => {
    it("should detect JavaScript CLI with high confidence", () => {
      const context: DetectionContext = {
        language: "javascript",
        dependencies: ["commander", "chalk", "ora"],
        scripts: {
          start: "node bin/cli.js",
          build: "npm run compile",
        },
        filePatterns: ["bin/cli.js", "src/commands/"],
        packageConfig: {
          name: "my-cli-tool",
          bin: {
            mycli: "bin/cli.js",
          },
          preferGlobal: true,
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
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.explanation).toContain("Dependencies:");
      expect(result.explanation.some((line) => line.includes("commander"))).toBe(true);
    });

    it("should detect Python CLI correctly", () => {
      const context: DetectionContext = {
        language: "python",
        dependencies: ["click", "rich", "typer"],
        scripts: {
          run: "python -m myapp.cli",
        },
        filePatterns: ["myapp/cli.py", "myapp/__main__.py"],
        packageConfig: {
          name: "my-python-cli",
          entry_points: {
            console_scripts: {
              mycli: "myapp.cli:main",
            },
          },
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
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should detect Rust CLI correctly", () => {
      const context: DetectionContext = {
        language: "rust",
        dependencies: ["clap", "anyhow", "indicatif"],
        scripts: {
          build: "cargo build",
          run: "cargo run",
        },
        filePatterns: ["src/main.rs", "src/cli/"],
        packageConfig: {
          name: "rust-cli-tool",
          bin: [{ name: "mytool", path: "src/main.rs" }],
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
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("Web Service vs CLI Disambiguation", () => {
    it("should correctly distinguish web service from CLI when both patterns exist", () => {
      const webContext: DetectionContext = {
        language: "javascript",
        dependencies: ["express", "cors", "morgan"], // Strong web indicators
        scripts: {
          start: "node server.js",
          dev: "nodemon server.js",
        },
        filePatterns: ["server.js", "routes/", "middleware/"],
        packageConfig: {
          name: "my-web-api",
          private: true,
        },
        sourceAnalysis: {
          hasBinaryExecution: false,
          hasServerPatterns: true,
          hasFrontendPatterns: false,
          hasCliPatterns: false,
          hasDataProcessingPatterns: false,
          hasTestPatterns: false,
          hasBuildPatterns: false,
          hasGamePatterns: false,
          hasMobilePatterns: false,
          hasDesktopPatterns: false,
        },
      };

      const cliContext: DetectionContext = {
        language: "javascript",
        dependencies: ["commander", "chalk", "axios"], // axios could be used by web too
        scripts: {
          start: "node bin/cli.js",
        },
        filePatterns: ["bin/cli.js", "src/commands/"],
        packageConfig: {
          name: "my-cli",
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

      const webResult = detectArtifactType(webContext);
      const cliResult = detectArtifactType(cliContext);

      expect(webResult.primaryType).toBe("web_service");
      expect(cliResult.primaryType).toBe("tool");
    });
  });

  describe("Multi-factor Detection", () => {
    it("should aggregate scores from dependencies, scripts, config, and source analysis", () => {
      const context: DetectionContext = {
        language: "javascript",
        dependencies: ["commander"], // CLI dependency
        scripts: {
          mycli: "node bin/cli.js", // CLI script
        },
        filePatterns: ["bin/cli.js"],
        packageConfig: {
          bin: { mycli: "bin/cli.js" }, // CLI config
        },
        sourceAnalysis: {
          hasBinaryExecution: true, // CLI source pattern
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
      expect(result.confidence).toBeGreaterThan(0.9); // High confidence due to multiple factors
      expect(result.factors.dependencyFactors.length).toBeGreaterThan(0);
      expect(result.factors.scriptFactors.length).toBeGreaterThan(0);
      expect(result.factors.configFactors.length).toBeGreaterThan(0);
      expect(result.factors.sourceFactors?.length).toBeGreaterThan(0);
    });

    it("should provide detailed breakdown of detection factors", () => {
      const context: DetectionContext = {
        language: "python",
        dependencies: ["click", "requests"],
        scripts: {},
        filePatterns: ["cli.py"],
        packageConfig: {
          entry_points: {
            console_scripts: {
              mytool: "mypackage.cli:main",
            },
          },
        },
      };

      const result = detectArtifactType(context);

      expect(result.factors.dependencyFactors).toBeDefined();
      expect(result.factors.configFactors).toBeDefined();
      expect(result.explanation.length).toBeGreaterThan(0);
    });
  });

  describe("Alternative Type Ranking", () => {
    it("should provide ranked alternatives when detection is ambiguous", () => {
      const ambiguousContext: DetectionContext = {
        language: "javascript",
        dependencies: ["express", "commander"], // Both web and CLI
        scripts: {
          start: "node app.js",
          cli: "node bin/cli.js",
        },
        filePatterns: ["app.js", "bin/cli.js"],
        packageConfig: {
          name: "multi-purpose-tool",
        },
      };

      const result = detectArtifactType(ambiguousContext);

      expect(result.alternativeTypes.length).toBeGreaterThan(0);
      expect(result.alternativeTypes[0].confidence).toBeLessThanOrEqual(result.confidence);

      // Should contain both web_service and tool as possibilities
      const typeNames = [result.primaryType, ...result.alternativeTypes.map((alt) => alt.type)];
      expect(typeNames).toContain("web_service");
      expect(typeNames).toContain("tool");
    });
  });

  describe("Language-Specific Patterns", () => {
    it("should handle Go import patterns correctly", () => {
      const context: DetectionContext = {
        language: "go",
        dependencies: ["github.com/spf13/cobra", "github.com/fatih/color"],
        scripts: {
          build: "go build",
          run: "go run main.go",
        },
        filePatterns: ["main.go", "cmd/"],
        packageConfig: {
          name: "go-cli-tool",
        },
      };

      const result = detectArtifactType(context);

      expect(result.primaryType).toBe("tool");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should handle C# namespace patterns correctly", () => {
      const context: DetectionContext = {
        language: "csharp",
        dependencies: ["CommandLineParser", "Spectre.Console"],
        scripts: {
          build: "dotnet build",
          run: "dotnet run",
        },
        filePatterns: ["Program.cs", "Commands/"],
        packageConfig: {
          name: "CSharpCliTool",
        },
      };

      const result = detectArtifactType(context);

      expect(result.primaryType).toBe("tool");
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle minimal context gracefully", () => {
      const minimalContext: DetectionContext = {
        language: "javascript",
        dependencies: [],
        scripts: {},
        filePatterns: [],
        packageConfig: {},
      };

      const result = detectArtifactType(minimalContext);

      expect(result.primaryType).toBe("module"); // Default fallback
      expect(result.confidence).toBeLessThan(0.5);
    });

    it("should handle unknown language gracefully", () => {
      const unknownLangContext: DetectionContext = {
        language: "unknown-language",
        dependencies: ["some-dependency"],
        scripts: {},
        filePatterns: [],
        packageConfig: {},
      };

      const result = detectArtifactType(unknownLangContext);

      expect(result.primaryType).toBe("module");
      expect(result.confidence).toBe(0);
    });
  });
});
