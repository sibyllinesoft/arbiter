import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { glob } from "glob";
import type { CLIConfig } from "../types.js";

/**
 * Revolutionary test scaffolding and coverage system
 * Transforms CUE invariants into executable property tests
 */

export interface TestsOptions {
  language?: "python" | "typescript" | "rust" | "go" | "bash";
  framework?: string;
  property?: boolean;
  output?: string;
  threshold?: number;
  junit?: string;
  force?: boolean;
  verbose?: boolean;
}

export interface Invariant {
  name: string;
  description: string;
  formula: string;
  parameters?: string[];
  testable: boolean;
}

export interface TestTemplate {
  filename: string;
  content: string;
  framework: string;
  language: string;
  invariantName: string;
}

export interface CoverageReport {
  timestamp: string;
  total_invariants: number;
  covered_invariants: number;
  coverage_ratio: number;
  threshold: number;
  passed: boolean;
  invariants: Array<{
    name: string;
    description: string;
    formula: string;
    covered: boolean;
    test_files: string[];
    test_count: number;
  }>;
  test_files: Array<{
    path: string;
    language: string;
    framework: string;
    invariants_covered: string[];
  }>;
}

/**
 * Language-specific test generation configurations
 */
const LANGUAGE_CONFIGS = {
  typescript: {
    framework: "vitest + fast-check",
    extension: ".test.ts",
    dependencies: ["vitest", "fast-check", "@types/node"],
    template: "vitest",
    propertyTestLib: "fast-check",
  },
  python: {
    framework: "pytest + hypothesis",
    extension: "_test.py",
    dependencies: ["pytest", "hypothesis"],
    template: "pytest",
    propertyTestLib: "hypothesis",
  },
  rust: {
    framework: "cargo test + proptest",
    extension: ".rs",
    dependencies: ["proptest"],
    template: "cargo-test",
    propertyTestLib: "proptest",
  },
  go: {
    framework: "go test",
    extension: "_test.go",
    dependencies: [],
    template: "go-test",
    propertyTestLib: "quick",
  },
  bash: {
    framework: "bats",
    extension: ".bats",
    dependencies: ["bats-core"],
    template: "bats",
    propertyTestLib: null,
  },
} as const;

/**
 * Parse CUE assembly file to extract invariants
 */
async function parseInvariants(assemblyPath: string): Promise<Invariant[]> {
  try {
    const content = await fs.readFile(assemblyPath, "utf-8");

    // Extract invariants section using regex
    // This is a simplified parser - in production, we'd use proper CUE parsing
    const invariantsMatch = content.match(/invariants:\s*\[([\s\S]*?)\n\s*\]/);

    if (!invariantsMatch || !invariantsMatch[1]) {
      throw new Error("No invariants section found in assembly file");
    }

    const invariantsText = invariantsMatch[1];
    const invariants: Invariant[] = [];

    // Parse individual invariants
    const invariantBlocks = invariantsText.split(/\n\s*\{\s*\n/).slice(1);

    for (const block of invariantBlocks) {
      const nameMatch = block.match(/name:\s*"([^"]+)"/);
      const descMatch = block.match(/description:\s*"([^"]+)"/);
      const formulaMatch = block.match(/formula:\s*"([^"]+)"/);

      if (nameMatch?.[1] && descMatch?.[1] && formulaMatch?.[1]) {
        const name = nameMatch[1];
        const description = descMatch[1];
        const formula = formulaMatch[1];

        invariants.push({
          name,
          description,
          formula,
          parameters: extractParametersFromFormula(formula),
          testable: isFormulaTestable(formula),
        });
      }
    }

    return invariants;
  } catch (error) {
    throw new Error(
      `Failed to parse invariants: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extract parameters from a logical formula
 */
function extractParametersFromFormula(formula: string): string[] {
  const params = new Set<string>();

  // Extract variables from universal quantifiers ∀x, ∀request, etc.
  const quantifierMatches = formula.matchAll(/∀(\w+)/g);
  for (const match of quantifierMatches) {
    params.add(match[1]);
  }

  // Extract function parameters f(x), duration(request), etc.
  const functionMatches = formula.matchAll(/\w+\((\w+)\)/g);
  for (const match of functionMatches) {
    params.add(match[1]);
  }

  return Array.from(params);
}

/**
 * Determine if a formula can be tested with property tests
 */
function isFormulaTestable(formula: string): boolean {
  // Formulas with universal quantifiers are typically testable
  if (formula.includes("∀")) return true;

  // Comparison operators suggest testable properties
  if (/[≤≥=<>]/.test(formula)) return true;

  // Logical operators suggest testable conditions
  if (/[∧∨¬]/.test(formula)) return true;

  // Negated existential quantifiers are often testable
  if (formula.includes("¬∃")) return true;

  return false;
}

/**
 * Generate test template content for a given invariant and language
 */
function generateTestTemplate(
  invariant: Invariant,
  language: keyof typeof LANGUAGE_CONFIGS,
): TestTemplate {
  const config = LANGUAGE_CONFIGS[language];
  const timestamp = new Date().toISOString();
  const marker = `ARBITER_INVARIANT_${invariant.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

  let content: string;

  switch (language) {
    case "typescript":
      content = generateTypeScriptTest(invariant, marker, timestamp);
      break;
    case "python":
      content = generatePythonTest(invariant, marker, timestamp);
      break;
    case "rust":
      content = generateRustTest(invariant, marker, timestamp);
      break;
    case "go":
      content = generateGoTest(invariant, marker, timestamp);
      break;
    case "bash":
      content = generateBashTest(invariant, marker, timestamp);
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  return {
    filename: `${invariant.name.replace(/[^a-zA-Z0-9]/g, "_")}${config.extension}`,
    content,
    framework: config.framework,
    language,
    invariantName: invariant.name,
  };
}

/**
 * Generate TypeScript test with fast-check
 */
function generateTypeScriptTest(invariant: Invariant, marker: string, timestamp: string): string {
  const hasParameters = invariant.parameters && invariant.parameters.length > 0;

  return `// ${marker}
// Generated test for invariant: ${invariant.name}
// Formula: ${invariant.formula}
// Generated at: ${timestamp}
// WARNING: Do not edit this block - it will be regenerated

import { test, expect, describe } from 'vitest';
import * as fc from 'fast-check';

describe('${invariant.name}', () => {
  test('${invariant.description}', () => {
    ${hasParameters ? generatePropertyTest(invariant) : generateUnitTest(invariant)}
  });
  
  test('${invariant.name} - edge cases', () => {
    // TODO: Implement edge case tests for ${invariant.formula}
    expect(true).toBe(true); // Placeholder
  });
});

// Helper functions for ${invariant.name}
// TODO: Implement actual logic being tested

/**
 * Test implementation for: ${invariant.formula}
 */
function testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}(${invariant.parameters?.join(": any, ") || ""}): boolean {
  // TODO: Implement test logic for ${invariant.description}
  return true; // Placeholder
}
`;
}

/**
 * Generate property test for invariants with parameters
 */
function generatePropertyTest(invariant: Invariant): string {
  const params = invariant.parameters || [];

  if (invariant.formula.includes("f(f(x)) = f(x)")) {
    // Idempotent property
    return `
    fc.assert(fc.property(
      fc.string(), // x
      (x) => {
        // Test: f(f(x)) = f(x)
        const result1 = testFunction(x);
        const result2 = testFunction(result1);
        expect(result2).toEqual(result1);
      }
    ));`;
  }

  if (invariant.formula.includes("f(x) = f(x)")) {
    // Deterministic property
    return `
    fc.assert(fc.property(
      fc.string(), // x
      (x) => {
        // Test: f(x) = f(x) (deterministic)
        const result1 = testFunction(x);
        const result2 = testFunction(x);
        expect(result2).toEqual(result1);
      }
    ));`;
  }

  if (invariant.formula.includes("duration") && invariant.formula.includes("≤")) {
    // Duration constraint
    return `
    fc.assert(fc.property(
      fc.record({
        payload: fc.string(),
        operation: fc.constantFrom('validate', 'analyze', 'execute')
      }),
      async (request) => {
        // Test: duration constraint
        const start = Date.now();
        await processRequest(request);
        const duration = Date.now() - start;
        expect(duration).toBeLessThanOrEqual(750); // 750ms constraint
      }
    ));`;
  }

  if (invariant.formula.includes("coverage_ratio")) {
    // Coverage threshold
    return `
    const coverageData = await getCoverageData();
    expect(coverageData.coverage_ratio).toBeGreaterThanOrEqual(0.8);`;
  }

  // Generic property test
  return `
    fc.assert(fc.property(
      ${params.map((p) => `fc.string() // ${p}`).join(",\n      ")},
      (${params.join(", ")}) => {
        // TODO: Implement property test for: ${invariant.formula}
        expect(testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}(${params.join(", ")})).toBe(true);
      }
    ));`;
}

/**
 * Generate unit test for invariants without parameters
 */
function generateUnitTest(invariant: Invariant): string {
  return `
    // Unit test for: ${invariant.formula}
    const result = testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}();
    expect(result).toBe(true);`;
}

/**
 * Generate Python test with hypothesis
 */
function generatePythonTest(invariant: Invariant, marker: string, timestamp: string): string {
  return `# ${marker}
# Generated test for invariant: ${invariant.name}
# Formula: ${invariant.formula}
# Generated at: ${timestamp}
# WARNING: Do not edit this block - it will be regenerated

import pytest
from hypothesis import given, strategies as st


class Test${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}:
    """Test suite for ${invariant.description}"""
    
    def test_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}(self):
        """Test: ${invariant.formula}"""
        # TODO: Implement test logic
        assert True  # Placeholder
    
    @given(st.text())
    def test_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_property(self, input_data):
        """Property test for ${invariant.description}"""
        # TODO: Implement property test for ${invariant.formula}
        result = test_invariant_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}(input_data)
        assert result is True


def test_invariant_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}(${invariant.parameters?.join(", ") || "data"}):
    """
    Test implementation for: ${invariant.formula}
    
    Args:
        ${invariant.parameters?.map((p) => `${p}: Input parameter`).join("\n        ") || "data: Input data"}
    
    Returns:
        bool: True if invariant holds
    """
    # TODO: Implement actual test logic
    return True
`;
}

/**
 * Generate Rust test with proptest
 */
function generateRustTest(invariant: Invariant, marker: string, timestamp: string): string {
  return `// ${marker}
// Generated test for invariant: ${invariant.name}
// Formula: ${invariant.formula}
// Generated at: ${timestamp}
// WARNING: Do not edit this block - it will be regenerated

use proptest::prelude::*;

#[cfg(test)]
mod ${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_tests {
    use super::*;
    
    #[test]
    fn test_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}() {
        // Test: ${invariant.formula}
        // TODO: Implement test logic
        assert!(true); // Placeholder
    }
    
    proptest! {
        #[test]
        fn test_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_property(
            input in ".*"
        ) {
            // Property test for: ${invariant.description}
            // Formula: ${invariant.formula}
            let result = test_invariant_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}(&input);
            prop_assert!(result);
        }
    }
}

/// Test implementation for: ${invariant.formula}
fn test_invariant_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}(${invariant.parameters?.join(": &str, ") || "data: &str"}): bool {
    // TODO: Implement actual test logic for ${invariant.description}
    true // Placeholder
}
`;
}

/**
 * Generate Go test
 */
function generateGoTest(invariant: Invariant, marker: string, timestamp: string): string {
  return `// ${marker}
// Generated test for invariant: ${invariant.name}
// Formula: ${invariant.formula}
// Generated at: ${timestamp}
// WARNING: Do not edit this block - it will be regenerated

package main

import (
    "testing"
    "testing/quick"
)

func Test${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}(t *testing.T) {
    // Test: ${invariant.formula}
    result := testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}("")
    if !result {
        t.Errorf("Invariant failed: %s", "${invariant.description}")
    }
}

func Test${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}Property(t *testing.T) {
    // Property test for: ${invariant.description}
    f := func(input string) bool {
        return testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}(input)
    }
    
    if err := quick.Check(f, nil); err != nil {
        t.Errorf("Property test failed: %v", err)
    }
}

// testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")} tests: ${invariant.formula}
func testInvariant${invariant.name.replace(/[^a-zA-Z0-9]/g, "")}(${invariant.parameters?.join(" string, ") || "data string"}) bool {
    // TODO: Implement actual test logic for ${invariant.description}
    return true // Placeholder
}
`;
}

/**
 * Generate Bash test with BATS
 */
function generateBashTest(invariant: Invariant, marker: string, timestamp: string): string {
  return `#!/usr/bin/env bats
# ${marker}
# Generated test for invariant: ${invariant.name}
# Formula: ${invariant.formula}
# Generated at: ${timestamp}
# WARNING: Do not edit this block - it will be regenerated

load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

@test "${invariant.name}: ${invariant.description}" {
    # Test: ${invariant.formula}
    run test_invariant_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}
    assert_success
}

@test "${invariant.name}: edge cases" {
    # Edge case tests for ${invariant.description}
    # TODO: Implement edge case tests
    run echo "placeholder"
    assert_success
}

# Test implementation for: ${invariant.formula}
test_invariant_${invariant.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}() {
    # TODO: Implement actual test logic for ${invariant.description}
    return 0 # Placeholder
}
`;
}

/**
 * Check if test files already exist (idempotent check)
 */
async function checkExistingTests(
  testTemplates: TestTemplate[],
  outputDir: string,
): Promise<string[]> {
  const existing: string[] = [];

  for (const template of testTemplates) {
    const filePath = path.join(outputDir, template.filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      if (
        content.includes(
          `ARBITER_INVARIANT_${template.invariantName.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
        )
      ) {
        existing.push(filePath);
      }
    } catch {
      // File doesn't exist, which is fine
    }
  }

  return existing;
}

/**
 * Analyze existing test files to determine coverage
 */
async function analyzeCoverage(
  invariants: Invariant[],
  testPaths: string[],
): Promise<CoverageReport> {
  const timestamp = new Date().toISOString();
  const testFiles: CoverageReport["test_files"] = [];
  const invariantCoverage: Map<
    string,
    { covered: boolean; test_files: string[]; test_count: number }
  > = new Map();

  // Initialize coverage tracking
  for (const invariant of invariants) {
    invariantCoverage.set(invariant.name, { covered: false, test_files: [], test_count: 0 });
  }

  // Analyze test files
  for (const testPath of testPaths) {
    try {
      const content = await fs.readFile(testPath, "utf-8");
      const language = detectLanguage(testPath);
      const framework = detectFramework(content, language);
      const invariantsCovered: string[] = [];

      // Look for Arbiter invariant markers
      for (const invariant of invariants) {
        const marker = `ARBITER_INVARIANT_${invariant.name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
        if (content.includes(marker)) {
          invariantsCovered.push(invariant.name);
          const coverage = invariantCoverage.get(invariant.name)!;
          coverage.covered = true;
          coverage.test_files.push(testPath);
          coverage.test_count += countTests(content, language);
        }
      }

      testFiles.push({
        path: testPath,
        language,
        framework,
        invariants_covered: invariantsCovered,
      });
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not analyze ${testPath}: ${error}`));
    }
  }

  // Calculate coverage metrics
  const coveredCount = Array.from(invariantCoverage.values()).filter((c) => c.covered).length;
  const coverage_ratio = invariants.length > 0 ? coveredCount / invariants.length : 0;

  return {
    timestamp,
    total_invariants: invariants.length,
    covered_invariants: coveredCount,
    coverage_ratio,
    threshold: 0.8, // Default threshold
    passed: coverage_ratio >= 0.8,
    invariants: invariants.map((inv) => ({
      name: inv.name,
      description: inv.description,
      formula: inv.formula,
      ...invariantCoverage.get(inv.name)!,
    })),
    test_files: testFiles,
  };
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath);
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "typescript";
    case ".py":
      return "python";
    case ".rs":
      return "rust";
    case ".go":
      return "go";
    case ".bats":
    case ".sh":
      return "bash";
    case ".js":
    case ".jsx":
      return "javascript";
    default:
      return "unknown";
  }
}

/**
 * Detect test framework from file content
 */
function detectFramework(content: string, language: string): string {
  if (content.includes("vitest") || content.includes("import { test")) return "vitest";
  if (content.includes("jest")) return "jest";
  if (content.includes("pytest") || content.includes("import pytest")) return "pytest";
  if (content.includes("proptest")) return "proptest";
  if (content.includes("@test") && language === "go") return "go test";
  if (content.includes("#!/usr/bin/env bats")) return "bats";

  return "unknown";
}

/**
 * Count number of test functions in a file
 */
function countTests(content: string, language: string): number {
  let count = 0;

  switch (language) {
    case "typescript":
    case "javascript":
      count += (content.match(/test\s*\(/g) || []).length;
      count += (content.match(/it\s*\(/g) || []).length;
      break;
    case "python":
      count += (content.match(/def test_\w+/g) || []).length;
      break;
    case "rust":
      count += (content.match(/#\[test\]/g) || []).length;
      break;
    case "go":
      count += (content.match(/func Test\w+/g) || []).length;
      break;
    case "bash":
      count += (content.match(/@test/g) || []).length;
      break;
  }

  return count;
}

/**
 * Generate JUnit XML for coverage report
 */
function generateJUnitXML(report: CoverageReport): string {
  const testcases = report.invariants
    .map(
      (inv) => `
    <testcase 
      classname="ContractCoverage" 
      name="${inv.name}" 
      time="0">
      ${inv.covered ? "" : `<failure message="Invariant not covered by tests">${inv.formula}</failure>`}
    </testcase>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${report.total_invariants}" failures="${report.total_invariants - report.covered_invariants}" time="0">
  <testsuite 
    name="Contract Coverage" 
    tests="${report.total_invariants}" 
    failures="${report.total_invariants - report.covered_invariants}" 
    time="0">
    ${testcases}
  </testsuite>
</testsuites>`;
}

/**
 * Scaffold command - Generate test skeletons from invariants
 */
/**
 * Scaffold setup - find assembly file and initialize
 */
async function initializeScaffoldSession(): Promise<{
  assemblyPath: string;
  invariants: Invariant[];
} | null> {
  console.log(chalk.blue("🧪 Generating test scaffolds from invariants..."));

  // Find assembly file
  const assemblyFiles = await glob("arbiter.assembly.cue");
  if (assemblyFiles.length === 0) {
    console.error(chalk.red("❌ No arbiter.assembly.cue file found"));
    console.log(chalk.dim("Run this command in a project with an Arbiter assembly file"));
    return null;
  }

  const assemblyPath = assemblyFiles[0];
  console.log(chalk.dim(`📋 Using assembly: ${assemblyPath}`));

  // Parse invariants
  const invariants = await parseInvariants(assemblyPath);
  console.log(chalk.cyan(`🔍 Found ${invariants.length} invariants`));

  if (invariants.length === 0) {
    console.log(chalk.yellow("No invariants found to generate tests from"));
    return null;
  }

  return { assemblyPath, invariants };
}

/**
 * Display invariants in verbose mode
 */
function displayInvariantsIfVerbose(invariants: Invariant[], verbose: boolean): void {
  if (!verbose) return;

  console.log(chalk.cyan("\nInvariants found:"));
  for (const inv of invariants) {
    console.log(chalk.dim(`  • ${inv.name}: ${inv.description}`));
    console.log(chalk.dim(`    Formula: ${inv.formula}`));
    console.log(chalk.dim(`    Testable: ${inv.testable ? "✅" : "❌"}`));
  }
}

/**
 * Generate test templates from invariants
 */
function generateTestTemplatesFromInvariants(
  invariants: Invariant[],
  language: string,
): { testTemplates: TestTemplate[]; skipped: string[] } {
  const testTemplates: TestTemplate[] = [];
  const skipped: string[] = [];

  for (const invariant of invariants) {
    if (!invariant.testable) {
      skipped.push(invariant.name);
      continue;
    }

    try {
      const template = generateTestTemplate(invariant, language);
      testTemplates.push(template);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Skipping ${invariant.name}: ${error}`));
      skipped.push(invariant.name);
    }
  }

  return { testTemplates, skipped };
}

/**
 * Write test files to filesystem
 */
async function writeTestFiles(
  testTemplates: TestTemplate[],
  outputDir: string,
  existingTests: string[],
  force: boolean,
): Promise<{ generated: number; updated: number }> {
  let generated = 0;
  let updated = 0;

  for (const template of testTemplates) {
    const filePath = path.join(outputDir, template.filename);
    const exists = existingTests.includes(filePath);

    if (exists && !force) {
      continue; // Skip existing unless forced
    }

    try {
      await fs.writeFile(filePath, template.content, "utf-8");

      if (exists) {
        updated++;
        console.log(chalk.green(`🔄 Updated: ${path.relative(process.cwd(), filePath)}`));
      } else {
        generated++;
        console.log(chalk.green(`✨ Generated: ${path.relative(process.cwd(), filePath)}`));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to write ${filePath}: ${error}`));
    }
  }

  return { generated, updated };
}

/**
 * Display scaffold summary and installation hints
 */
function displayScaffoldSummary(
  generated: number,
  updated: number,
  existingTests: string[],
  language: string,
  outputDir: string,
  skipped: string[],
): void {
  console.log(chalk.blue("\n📊 Scaffold Summary:"));
  console.log(`  Generated: ${chalk.green(generated)} new test files`);
  console.log(`  Updated: ${chalk.yellow(updated)} existing test files`);
  console.log(`  Skipped: ${chalk.dim(existingTests.length - updated)} existing test files`);
  console.log(`  Language: ${language} (${LANGUAGE_CONFIGS[language].framework})`);
  console.log(`  Output: ${outputDir}`);

  if (skipped.length > 0) {
    console.log(chalk.dim(`\nNon-testable invariants: ${skipped.join(", ")}`));
  }

  // Installation hints
  const deps = LANGUAGE_CONFIGS[language].dependencies;
  if (deps.length > 0) {
    console.log(chalk.cyan("\n💡 Installation hint:"));
    switch (language) {
      case "typescript":
        console.log(chalk.dim(`  npm install --save-dev ${deps.join(" ")}`));
        break;
      case "python":
        console.log(chalk.dim(`  pip install ${deps.join(" ")}`));
        break;
      case "rust":
        console.log(chalk.dim(`  cargo add --dev ${deps.join(" ")}`));
        break;
    }
  }
}

export async function scaffoldCommand(options: TestsOptions, _config: CLIConfig): Promise<number> {
  try {
    const context = await initializeScaffoldContext(options);
    if (!context) return 1;

    const language = determineTargetLanguage(options);
    const { testTemplates, skipped } = generateTestTemplatesFromInvariants(context.invariants, language);
    
    if (testTemplates.length === 0) {
      return handleNoTestableInvariants(skipped);
    }

    const outputDir = prepareOutputDirectory(options, language);
    const existingTests = await processExistingTests(testTemplates, outputDir, options.force);
    const results = await executeTestFileGeneration(testTemplates, outputDir, existingTests, options.force);
    
    displayScaffoldSummary(results.generated, results.updated, existingTests, language, outputDir, skipped);
    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Scaffold failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

interface ScaffoldContext {
  invariants: Invariant[];
  assemblyPath: string;
}

async function initializeScaffoldContext(options: TestsOptions): Promise<ScaffoldContext | null> {
  const result = await initializeScaffoldSession();
  if (!result) return null;

  displayInvariantsIfVerbose(result.invariants, options.verbose || false);
  return { invariants: result.invariants, assemblyPath: result.assemblyPath };
}

function determineTargetLanguage(options: TestsOptions): string {
  const language = options.language || "typescript";
  console.log(chalk.blue(`🎯 Generating tests for: ${language}`));
  return language;
}

function handleNoTestableInvariants(skipped: string[]): number {
  console.log(chalk.yellow("No testable invariants found"));
  if (skipped.length > 0) {
    console.log(chalk.dim(`Skipped: ${skipped.join(", ")}`));
  }
  return 0;
}

function prepareOutputDirectory(options: TestsOptions, language: string): string {
  return options.outputDir || options.output || getDefaultTestDir(language);
}

async function processExistingTests(
  testTemplates: TestTemplate[], 
  outputDir: string, 
  force?: boolean
): Promise<string[]> {
  await fs.mkdir(outputDir, { recursive: true });
  const existingTests = await checkExistingTests(testTemplates, outputDir);

  if (existingTests.length > 0 && !force) {
    console.log(chalk.yellow(`🔄 Found ${existingTests.length} existing test(s):`));
    for (const existing of existingTests) {
      console.log(chalk.dim(`  • ${path.relative(process.cwd(), existing)}`));
    }
    console.log(chalk.dim("Use --force to regenerate existing tests"));
  }

  return existingTests;
}

async function executeTestFileGeneration(
  testTemplates: TestTemplate[],
  outputDir: string,
  existingTests: string[],
  force?: boolean
): Promise<{ generated: number; updated: number }> {
  return await writeTestFiles(testTemplates, outputDir, existingTests, force || false);
}

/**
 * Cover command - Compute contract coverage metrics
 */
export async function coverCommand(options: TestsOptions, _config: CLIConfig): Promise<number> {
  try {
    console.log(chalk.blue("📊 Computing contract coverage..."));

    // Find assembly file
    const assemblyFiles = await glob("arbiter.assembly.cue");
    if (assemblyFiles.length === 0) {
      console.error(chalk.red("❌ No arbiter.assembly.cue file found"));
      return 1;
    }

    // Parse invariants
    const invariants = await parseInvariants(assemblyFiles[0]);
    console.log(chalk.dim(`📋 Found ${invariants.length} invariants`));

    // Find test files
    const testPatterns = [
      "**/*.test.ts",
      "**/*.test.js",
      "**/*_test.py",
      "**/test_*.py",
      "**/*.rs",
      "**/*_test.go",
      "**/*.bats",
    ];

    const testFiles: string[] = [];
    for (const pattern of testPatterns) {
      const files = await glob(pattern, { ignore: ["node_modules/**", "target/**", ".git/**"] });
      testFiles.push(...files);
    }

    console.log(chalk.dim(`🔍 Analyzing ${testFiles.length} test files`));

    // Analyze coverage
    const report = await analyzeCoverage(invariants, testFiles);
    const threshold = options.threshold || 0.8;
    report.threshold = threshold;
    report.passed = report.coverage_ratio >= threshold;

    // Display results
    console.log(chalk.blue("\n📈 Contract Coverage Report:"));
    console.log(`  Total invariants: ${report.total_invariants}`);
    console.log(`  Covered invariants: ${chalk.green(report.covered_invariants)}`);
    console.log(
      `  Coverage ratio: ${report.coverage_ratio >= threshold ? chalk.green : chalk.red}${(report.coverage_ratio * 100).toFixed(1)}%`,
    );
    console.log(`  Threshold: ${(threshold * 100).toFixed(1)}%`);
    console.log(`  Status: ${report.passed ? chalk.green("✅ PASSED") : chalk.red("❌ FAILED")}`);

    // Detailed breakdown
    if (options.verbose) {
      console.log(chalk.cyan("\n📋 Invariant Details:"));
      for (const inv of report.invariants) {
        const status = inv.covered ? chalk.green("✅") : chalk.red("❌");
        console.log(`  ${status} ${inv.name}`);
        console.log(`      ${chalk.dim(inv.description)}`);
        if (inv.covered && inv.test_files.length > 0) {
          console.log(
            `      ${chalk.dim(`Tests: ${inv.test_files.map((f) => path.relative(process.cwd(), f)).join(", ")}`)}`,
          );
        }
      }

      console.log(chalk.cyan("\n📁 Test Files:"));
      for (const file of report.test_files) {
        console.log(`  • ${path.relative(process.cwd(), file.path)} (${file.language})`);
        if (file.invariants_covered.length > 0) {
          console.log(`    ${chalk.dim(`Covers: ${file.invariants_covered.join(", ")}`)}`);
        }
      }
    }

    // Write JSON report
    const outputDir = options.outputDir || ".";
    const reportFilename = options.output || "coverage-report.json";
    const reportPath = path.isAbsolute(reportFilename)
      ? reportFilename
      : path.join(outputDir, reportFilename);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.dim(`\n📄 Report saved: ${reportPath}`));

    // Write JUnit XML if requested
    if (options.junit) {
      const junitXml = generateJUnitXML(report);
      const junitPath = path.isAbsolute(options.junit)
        ? options.junit
        : path.join(outputDir, options.junit);

      // Ensure directory exists
      await fs.mkdir(path.dirname(junitPath), { recursive: true });

      await fs.writeFile(junitPath, junitXml);
      console.log(chalk.dim(`📄 JUnit report saved: ${junitPath}`));
    }

    return report.passed ? 0 : 1;
  } catch (error) {
    console.error(
      chalk.red("❌ Coverage analysis failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Get default test directory for a language
 */
function getDefaultTestDir(language: string): string {
  switch (language) {
    case "typescript":
    case "javascript":
      return "tests";
    case "python":
      return "tests";
    case "rust":
      return "src";
    case "go":
      return ".";
    case "bash":
      return "tests";
    default:
      return "tests";
  }
}
