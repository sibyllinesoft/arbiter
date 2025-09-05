import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { APISurface } from "./surface.js";
import { type VersionPlan, versionPlanCommand, versionReleaseCommand } from "./version.js";

// Test fixtures directory
const fixturesDir = join(process.cwd(), "test-fixtures-version");

// Mock CLI config
const mockConfig = {
  apiUrl: "http://localhost:8080",
  timeout: 5000,
  format: "table" as const,
  color: true,
  projectDir: fixturesDir,
};

// Sample API surfaces for testing
const sampleSurfaceV1: APISurface = {
  language: "typescript",
  version: "5.0.0",
  timestamp: Date.now() - 86400000, // 1 day ago
  symbols: [
    {
      name: "calculateSum",
      type: "function",
      visibility: "public",
      signature: "function calculateSum(a: number, b: number): number",
      location: { file: "math.ts", line: 10, column: 1 },
      parameters: [
        { name: "a", type: "number" },
        { name: "b", type: "number" },
      ],
      returnType: "number",
    },
    {
      name: "User",
      type: "interface",
      visibility: "public",
      signature: "interface User { id: string; name: string; }",
      location: { file: "types.ts", line: 5, column: 1 },
    },
  ],
  statistics: {
    totalSymbols: 2,
    publicSymbols: 2,
    privateSymbols: 0,
    byType: {
      function: 1,
      interface: 1,
    },
  },
};

const sampleSurfaceV2: APISurface = {
  language: "typescript",
  version: "5.0.0",
  timestamp: Date.now(),
  symbols: [
    // Modified function (breaking change)
    {
      name: "calculateSum",
      type: "function",
      visibility: "public",
      signature: "function calculateSum(a: number, b: number, c: number): number",
      location: { file: "math.ts", line: 10, column: 1 },
      parameters: [
        { name: "a", type: "number" },
        { name: "b", type: "number" },
        { name: "c", type: "number" }, // New required parameter = breaking
      ],
      returnType: "number",
    },
    // Unchanged interface
    {
      name: "User",
      type: "interface",
      visibility: "public",
      signature: "interface User { id: string; name: string; }",
      location: { file: "types.ts", line: 5, column: 1 },
    },
    // New function (feature)
    {
      name: "multiply",
      type: "function",
      visibility: "public",
      signature: "function multiply(x: number, y: number): number",
      location: { file: "math.ts", line: 20, column: 1 },
      parameters: [
        { name: "x", type: "number" },
        { name: "y", type: "number" },
      ],
      returnType: "number",
    },
  ],
  statistics: {
    totalSymbols: 3,
    publicSymbols: 3,
    privateSymbols: 0,
    byType: {
      function: 2,
      interface: 1,
    },
  },
};

const sampleSurfaceV3: APISurface = {
  language: "typescript",
  version: "5.0.0",
  timestamp: Date.now(),
  symbols: [
    // Same as V1 - just internal changes (PATCH)
    {
      name: "calculateSum",
      type: "function",
      visibility: "public",
      signature: "function calculateSum(a: number, b: number): number",
      location: { file: "math.ts", line: 10, column: 1 },
      parameters: [
        { name: "a", type: "number" },
        { name: "b", type: "number" },
      ],
      returnType: "number",
    },
    {
      name: "User",
      type: "interface",
      visibility: "public",
      signature: "interface User { id: string; name: string; }",
      location: { file: "types.ts", line: 5, column: 1 },
    },
  ],
  statistics: {
    totalSymbols: 2,
    publicSymbols: 2,
    privateSymbols: 0,
    byType: {
      function: 1,
      interface: 1,
    },
  },
};

const samplePackageJson = {
  name: "test-package",
  version: "1.2.3",
  description: "Test package for version management",
  main: "index.js",
};

const samplePyprojectToml = `[project]
name = "test-package"
version = "0.5.0"
description = "Test Python package"
`;

const sampleCargoToml = `[package]
name = "test-package"
version = "2.1.0"
edition = "2021"
`;

describe("Version Management", () => {
  beforeEach(async () => {
    // Create test directory
    if (!existsSync(fixturesDir)) {
      await mkdir(fixturesDir, { recursive: true });
    }

    // Change to test directory
    process.chdir(fixturesDir);
  });

  afterEach(async () => {
    // Clean up
    if (existsSync(fixturesDir)) {
      await rm(fixturesDir, { recursive: true, force: true });
    }

    // Return to original directory
    process.chdir(process.cwd().replace(fixturesDir, "").replace(/\/$/, "") || "/");
  });

  describe("Version Plan Command", () => {
    it("should detect MAJOR version bump for breaking changes", async () => {
      // Setup: Create surface files
      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(sampleSurfaceV2, null, 2));

      const exitCode = await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);
      expect(existsSync("version_plan.json")).toBe(true);

      // Read and verify plan
      const planContent = await readFile("version_plan.json", "utf-8");
      const plan: VersionPlan = JSON.parse(planContent);

      expect(plan.required_bump).toBe("MAJOR");
      expect(plan.breaking_changes).toHaveLength(1);
      expect(plan.breaking_changes[0].symbol).toBe("calculateSum");
      expect(plan.new_features).toHaveLength(1);
      expect(plan.new_features[0].symbol).toBe("multiply");
      expect(plan.statistics.breaking_count).toBe(1);
      expect(plan.statistics.feature_count).toBe(1);
    });

    it("should detect MINOR version bump for new features only", async () => {
      // Create surface with only new features, no breaking changes
      const nonBreakingSurface: APISurface = {
        ...sampleSurfaceV1,
        symbols: [
          ...sampleSurfaceV1.symbols, // Keep all original symbols unchanged
          // Add only the new multiply function
          {
            name: "multiply",
            type: "function",
            visibility: "public",
            signature: "function multiply(x: number, y: number): number",
            location: { file: "math.ts", line: 20, column: 1 },
            parameters: [
              { name: "x", type: "number" },
              { name: "y", type: "number" },
            ],
            returnType: "number",
          },
        ],
        statistics: {
          totalSymbols: 3,
          publicSymbols: 3,
          privateSymbols: 0,
          byType: {
            function: 2,
            interface: 1,
          },
        },
      };

      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(nonBreakingSurface, null, 2));

      const exitCode = await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const planContent = await readFile("version_plan.json", "utf-8");
      const plan: VersionPlan = JSON.parse(planContent);

      expect(plan.required_bump).toBe("MINOR");
      expect(plan.breaking_changes).toHaveLength(0);
      expect(plan.new_features).toHaveLength(1);
      expect(plan.statistics.feature_count).toBe(1);
    });

    it("should detect PATCH version bump for no API changes", async () => {
      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(sampleSurfaceV3, null, 2));

      const exitCode = await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const planContent = await readFile("version_plan.json", "utf-8");
      const plan: VersionPlan = JSON.parse(planContent);

      expect(plan.required_bump).toBe("PATCH");
      expect(plan.breaking_changes).toHaveLength(0);
      expect(plan.new_features).toHaveLength(0);
    });

    it("should handle first version (no previous surface)", async () => {
      await writeFile("surface.json", JSON.stringify(sampleSurfaceV1, null, 2));

      const exitCode = await versionPlanCommand(
        {
          current: "surface.json",
          output: "version_plan.json",
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const planContent = await readFile("version_plan.json", "utf-8");
      const plan: VersionPlan = JSON.parse(planContent);

      expect(plan.required_bump).toBe("MINOR"); // Initial version with features
      expect(plan.breaking_changes).toHaveLength(0);
      expect(plan.new_features).toHaveLength(2); // All symbols are "new"
    });

    it("should fail in strict mode with breaking changes", async () => {
      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(sampleSurfaceV2, null, 2));

      const exitCode = await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
          strict: true,
        },
        mockConfig,
      );

      expect(exitCode).toBe(1); // Should fail in strict mode
    });

    it("should return error for missing current surface", async () => {
      const exitCode = await versionPlanCommand(
        {
          current: "nonexistent.json",
        },
        mockConfig,
      );

      expect(exitCode).toBe(1);
    });
  });

  describe("Version Release Command", () => {
    beforeEach(async () => {
      // Create sample version plan
      const samplePlan: VersionPlan = {
        timestamp: Date.now(),
        current_version: "1.2.3",
        required_bump: "MINOR",
        rationale: "1 new feature(s) added",
        breaking_changes: [],
        new_features: [
          {
            type: "added",
            symbol: "multiply",
            symbolType: "function",
            breaking: false,
            description: "Added function 'multiply'",
            newSignature: "function multiply(x: number, y: number): number",
          },
        ],
        bug_fixes: [],
        statistics: {
          total_changes: 1,
          breaking_count: 0,
          feature_count: 1,
          fix_count: 0,
        },
        strict_mode: false,
        recommendations: [],
      };

      await writeFile("version_plan.json", JSON.stringify(samplePlan, null, 2));
    });

    it("should detect and show manifest updates in dry-run mode", async () => {
      // Create sample manifests
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));
      await writeFile("pyproject.toml", samplePyprojectToml);
      await writeFile("Cargo.toml", sampleCargoToml);

      const exitCode = await versionReleaseCommand(
        {
          plan: "version_plan.json",
          dryRun: true, // Default behavior
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Verify files are unchanged in dry-run
      const packageContent = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(packageContent);
      expect(pkg.version).toBe("1.2.3"); // Unchanged
    });

    it("should update manifests when apply flag is used", async () => {
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));

      const exitCode = await versionReleaseCommand(
        {
          plan: "version_plan.json",
          apply: true, // Enable actual updates
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Verify package.json was updated
      const packageContent = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(packageContent);
      expect(pkg.version).toBe("1.3.0"); // MINOR bump: 1.2.3 -> 1.3.0
    });

    it("should support explicit version override", async () => {
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));

      const exitCode = await versionReleaseCommand(
        {
          version: "2.0.0",
          apply: true,
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      const packageContent = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(packageContent);
      expect(pkg.version).toBe("2.0.0");
    });

    it("should generate changelog with proper formatting", async () => {
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));

      const exitCode = await versionReleaseCommand(
        {
          plan: "version_plan.json",
          changelog: "CHANGELOG.md",
          apply: true,
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);
      expect(existsSync("CHANGELOG.md")).toBe(true);

      const changelogContent = await readFile("CHANGELOG.md", "utf-8");

      expect(changelogContent).toContain("## [1.3.0]");
      expect(changelogContent).toContain("### ✨ Features");
      expect(changelogContent).toContain("Added function 'multiply'");
      expect(changelogContent).toContain("### 📊 Statistics");
      expect(changelogContent).toContain("Total changes: 1");
    });

    it("should handle multiple manifest types", async () => {
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));
      await writeFile("pyproject.toml", samplePyprojectToml);
      await writeFile("Cargo.toml", sampleCargoToml);

      const exitCode = await versionReleaseCommand(
        {
          plan: "version_plan.json",
          apply: true,
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);

      // Check all manifests were updated
      const packageContent = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(packageContent);
      expect(pkg.version).toBe("1.3.0");

      const pyprojectContent = await readFile("pyproject.toml", "utf-8");
      expect(pyprojectContent).toContain('version = "1.3.0"'); // Same version applied to all

      const cargoContent = await readFile("Cargo.toml", "utf-8");
      expect(cargoContent).toContain('version = "1.3.0"'); // Same version applied to all
    });

    it("should handle Go projects with git tag recommendations", async () => {
      await writeFile("go.mod", "module example.com/test\n\ngo 1.21\n");

      const exitCode = await versionReleaseCommand(
        {
          version: "1.5.0",
          dryRun: true,
        },
        mockConfig,
      );

      expect(exitCode).toBe(0);
      // Should output git tag recommendations in the logs
    });

    it("should return error for missing manifests", async () => {
      const exitCode = await versionReleaseCommand(
        {
          plan: "version_plan.json",
        },
        mockConfig,
      );

      expect(exitCode).toBe(1); // No manifests found
    });

    it("should return error for missing plan and version", async () => {
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));

      const exitCode = await versionReleaseCommand({}, mockConfig);

      expect(exitCode).toBe(1); // No version or plan specified
    });
  });

  describe("Version Calculation Logic", () => {
    it("should calculate MAJOR version bump correctly", async () => {
      // Test the internal version calculation logic through the command
      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(sampleSurfaceV2, null, 2));

      await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
        },
        mockConfig,
      );

      const planContent = await readFile("version_plan.json", "utf-8");
      const plan: VersionPlan = JSON.parse(planContent);

      // Should detect breaking change (parameter addition)
      expect(plan.required_bump).toBe("MAJOR");
      expect(plan.breaking_changes[0].oldSignature).toContain("a: number, b: number");
      expect(plan.breaking_changes[0].newSignature).toContain("a: number, b: number, c: number");
    });

    it("should identify signature changes as breaking", async () => {
      const modifiedSurface: APISurface = {
        ...sampleSurfaceV1,
        symbols: [
          {
            ...sampleSurfaceV1.symbols[0],
            signature: "function calculateSum(nums: number[]): number", // Changed parameters = breaking
            returnType: "number",
          },
          sampleSurfaceV1.symbols[1],
        ],
      };

      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(modifiedSurface, null, 2));

      await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
        },
        mockConfig,
      );

      const planContent = await readFile("version_plan.json", "utf-8");
      const plan: VersionPlan = JSON.parse(planContent);

      expect(plan.required_bump).toBe("MAJOR");
      expect(plan.breaking_changes).toHaveLength(1);
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete workflow: surface -> plan -> release", async () => {
      // 1. Create initial surface
      await writeFile("surface-prev.json", JSON.stringify(sampleSurfaceV1, null, 2));
      await writeFile("surface.json", JSON.stringify(sampleSurfaceV2, null, 2));
      await writeFile("package.json", JSON.stringify(samplePackageJson, null, 2));

      // 2. Generate plan
      const planExitCode = await versionPlanCommand(
        {
          current: "surface.json",
          previous: "surface-prev.json",
          output: "version_plan.json",
        },
        mockConfig,
      );
      expect(planExitCode).toBe(0);

      // 3. Execute release
      const releaseExitCode = await versionReleaseCommand(
        {
          plan: "version_plan.json",
          apply: true,
        },
        mockConfig,
      );
      expect(releaseExitCode).toBe(0);

      // 4. Verify results
      const packageContent = await readFile("package.json", "utf-8");
      const pkg = JSON.parse(packageContent);
      expect(pkg.version).toBe("2.0.0"); // MAJOR bump: 1.2.3 -> 2.0.0

      expect(existsSync("CHANGELOG.md")).toBe(true);
      const changelogContent = await readFile("CHANGELOG.md", "utf-8");
      expect(changelogContent).toContain("## [2.0.0]");
      expect(changelogContent).toContain("💥 BREAKING CHANGES");
    });
  });
});
