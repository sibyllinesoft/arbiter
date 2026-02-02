/**
 * @packageDocumentation
 * Test composition engine for generating and merging test suites.
 * Provides intelligent namespace generation and conflict resolution.
 */

import path from "node:path";
import { writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, toPathSegments } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { ProjectStructureConfig } from "@/types.js";
import type {
  PackageConfig,
  TestCase,
  TestCompositionResult,
  TestSuite,
} from "@arbiter/specification";
import fs from "fs-extra";

/** Type alias for deployment service configuration */
type DeploymentServiceConfig = Partial<PackageConfig> & {
  /** Artifact type for deployment classification */
  artifactType?: "internal" | "external";
  /** Service name */
  name?: string;
  /** Image for deployment */
  image?: string;
  /** Ports configuration */
  ports?: Array<{ name: string; port: number; targetPort?: number; protocol?: string }>;
  /** Volumes configuration */
  volumes?: Array<{ name: string; path: string; size?: string }>;
};

const DEFAULT_PROJECT_STRUCTURE: ProjectStructureConfig = {
  servicesDirectory: "services",
  clientsDirectory: "clients",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  testsDirectory: "tests",
  docsDirectory: "docs",
  infraDirectory: "infra",
};

/**
 * Result from merging conflicting test suites
 */
interface MergeResult {
  suite: TestSuite;
  conflicts: Array<{ test: string; reason: string; resolution: "skip" | "merge" | "replace" }>;
  generated: TestCase[];
  preserved: TestCase[];
}

// Fallback reporter
const reporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

/**
 * Test composition engine for merging existing and generated tests
 */
export class TestCompositionEngine {
  private specName: string;
  private namespace: string;

  constructor(specName: string, baseNamespace?: string) {
    this.specName = specName;
    this.namespace = baseNamespace || this.generateBaseNamespace(specName);
  }

  /**
   * Discover existing test files in the project
   */
  async discoverExistingTests(outputDir: string): Promise<TestSuite[]> {
    const testSuites: TestSuite[] = [];
    const testDirs = ["tests", "test", "__tests__", "spec"];

    for (const testDir of testDirs) {
      const fullPath = path.join(outputDir, testDir);
      if (fs.existsSync(fullPath)) {
        const testFiles = await this.findTestFiles(fullPath);
        for (const testFile of testFiles) {
          const suite = await this.parseTestFile(testFile);
          if (suite) {
            testSuites.push(suite);
          }
        }
      }
    }

    return testSuites;
  }

  /**
   * Generate namespace for new tests based on spec and service
   */
  generateTestNamespace(serviceName: string): string {
    return `${this.namespace}.${serviceName}`.toLowerCase().replace(/[^a-z0-9.]/g, "_");
  }

  /**
   * Merge existing and new test suites intelligently
   */
  mergeTestSuites(existing: TestSuite[], newSuites: TestSuite[]): TestCompositionResult {
    const result: TestCompositionResult = {
      merged: [],
      conflicts: [],
      generated: [],
      preserved: [],
    };

    const existingMap = new Map<string, TestSuite>();
    existing.forEach((suite) => existingMap.set(suite.namespace, suite));

    for (const newSuite of newSuites) {
      const existingSuite = existingMap.get(newSuite.namespace);

      if (!existingSuite) {
        result.merged.push(newSuite);
        result.generated.push(...newSuite.cases);
      } else {
        const merged = this.mergeConflictingSuites(existingSuite, newSuite);
        result.merged.push(merged.suite);
        result.conflicts.push(...merged.conflicts);
        result.generated.push(...merged.generated);
        result.preserved.push(...merged.preserved);
        existingMap.delete(newSuite.namespace);
      }
    }

    existingMap.forEach((suite) => {
      result.merged.push(suite);
      result.preserved.push(...suite.cases);
    });

    return result;
  }

  /**
   * Handle adding a new test case (no conflict)
   */
  private handleNewTestCase(result: MergeResult, newCase: TestCase): void {
    result.suite.cases.push(newCase);
    result.generated.push(newCase);
  }

  /**
   * Handle replacing a generated test case
   */
  private handleGeneratedTestReplace(result: MergeResult, newCase: TestCase): void {
    const index = result.suite.cases.findIndex((c) => c.name === newCase.name);
    if (index >= 0) {
      result.suite.cases[index] = newCase;
      result.generated.push(newCase);
      result.conflicts.push({
        test: newCase.name,
        reason: "Generated test updated",
        resolution: "replace",
      });
    }
  }

  /**
   * Handle custom test conflict by renaming
   */
  private handleCustomTestConflict(result: MergeResult, newCase: TestCase): void {
    const renamedCase = {
      ...newCase,
      name: `${newCase.name}_generated`,
      namespace: `${newCase.namespace}.generated`,
    };
    result.suite.cases.push(renamedCase);
    result.generated.push(renamedCase);
    result.conflicts.push({
      test: newCase.name,
      reason: "Custom test exists",
      resolution: "skip",
    });
  }

  /**
   * Safely merge two conflicting test suites
   */
  private mergeConflictingSuites(existing: TestSuite, newSuite: TestSuite): MergeResult {
    const result: MergeResult = {
      suite: { ...existing },
      conflicts: [],
      generated: [],
      preserved: [...existing.cases],
    };

    const existingCases = new Map<string, TestCase>();
    existing.cases.forEach((testCase) => existingCases.set(testCase.name, testCase));

    for (const newCase of newSuite.cases) {
      const existingCase = existingCases.get(newCase.name);

      if (!existingCase) {
        this.handleNewTestCase(result, newCase);
      } else if (this.isGeneratedTest(existingCase)) {
        this.handleGeneratedTestReplace(result, newCase);
      } else {
        this.handleCustomTestConflict(result, newCase);
      }
    }

    return result;
  }

  private isGeneratedTest(testCase: TestCase): boolean {
    return (
      testCase.metadata?.generated === true ||
      testCase.metadata?.source === "arbiter" ||
      testCase.namespace.includes("generated")
    );
  }

  private generateBaseNamespace(specName: string): string {
    return `arbiter.${specName}`.toLowerCase().replace(/[^a-z0-9.]/g, "_");
  }

  private async findTestFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.findTestFiles(fullPath)));
      } else if (this.isTestFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\.(js|ts|py|rs|go)$/,
      /\.spec\.(js|ts|py|rs|go)$/,
      /_test\.(js|ts|py|rs|go)$/,
      /test_.*\.(py)$/,
    ];
    return testPatterns.some((pattern) => pattern.test(filename));
  }

  /**
   * Test parser configuration for different file types
   */
  private static readonly TEST_PARSERS: Array<{
    extensions: string[];
    pattern: RegExp;
    extractName: (match: string) => string | null;
  }> = [
    {
      extensions: [".js", ".ts"],
      pattern: /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      extractName: (match) => match.match(/['"`]([^'"`]+)['"`]/)?.[1] ?? null,
    },
    {
      extensions: [".py"],
      pattern: /def\s+(test_\w+)/g,
      extractName: (match) => match.match(/def\s+(test_\w+)/)?.[1] ?? null,
    },
  ];

  /**
   * Extract test cases from file content using the appropriate parser
   */
  private extractTestCases(content: string, ext: string, namespace: string): TestCase[] {
    const parser = TestCompositionEngine.TEST_PARSERS.find((p) => p.extensions.includes(ext));
    if (!parser) return [];

    const testMatches = content.match(parser.pattern) ?? [];
    return testMatches
      .map((match) => {
        const name = parser.extractName(match);
        if (!name) return null;
        return {
          name,
          namespace,
          steps: [],
          metadata: {
            generated: false,
            source: "existing",
            lastModified: new Date().toISOString(),
          },
        };
      })
      .filter((tc): tc is NonNullable<typeof tc> => tc !== null) as TestCase[];
  }

  /**
   * Build a test suite from parsed test cases
   */
  private buildTestSuite(filePath: string, testCases: TestCase[]): TestSuite | null {
    if (testCases.length === 0) return null;

    return {
      name: path.basename(filePath, path.extname(filePath)),
      namespace: this.extractNamespaceFromFile(filePath),
      cases: testCases,
      setup: [],
      teardown: [],
    };
  }

  private async parseTestFile(filePath: string): Promise<TestSuite | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const ext = path.extname(filePath);
      const namespace = this.extractNamespaceFromFile(filePath);
      const testCases = this.extractTestCases(content, ext, namespace);
      return this.buildTestSuite(filePath, testCases);
    } catch (error) {
      reporter.warn(`Warning: Could not parse test file ${filePath}:`, error);
      return null;
    }
  }

  private extractNamespaceFromFile(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const parts = relativePath.split(path.sep);
    const fileName = path.basename(filePath, path.extname(filePath));
    const cleanFileName = fileName.replace(/\.(test|spec)$/, "");
    const namespaceParts = [...parts.slice(0, -1), cleanFileName];
    return namespaceParts
      .join(".")
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "_");
  }
}

/**
 * Create standard metadata for generated test cases
 */
function createGeneratedMetadata(): TestCase["metadata"] {
  return {
    generated: true,
    source: "arbiter",
    lastModified: new Date().toISOString(),
  };
}

/**
 * Generate health check test case for service
 */
function generateHealthCheckTest(serviceName: string, namespace: string, port: number): TestCase {
  return {
    name: `${serviceName}_health_check`,
    namespace,
    description: `Health check for ${serviceName} service`,
    steps: [
      {
        action: "http_request",
        params: { method: "GET", url: `http://localhost:${port}/health`, timeout: 5000 },
        expected: { status: 200 },
      },
    ],
    metadata: createGeneratedMetadata(),
  };
}

/**
 * Generate port connectivity test case
 */
function generatePortConnectivityTest(
  serviceName: string,
  namespace: string,
  port: { port: number; name?: string },
): TestCase {
  return {
    name: `${serviceName}_port_${port.port}_connectivity`,
    namespace,
    description: `Test ${port.name || port.port} port connectivity`,
    steps: [
      {
        action: "tcp_connect",
        params: { host: "localhost", port: port.port, timeout: 3000 },
        expected: { connected: true },
      },
    ],
    metadata: createGeneratedMetadata(),
  };
}

/**
 * Generate environment variables test case
 */
function generateEnvVarsTest(serviceName: string, namespace: string, envKeys: string[]): TestCase {
  return {
    name: `${serviceName}_environment_variables`,
    namespace,
    description: `Verify environment variables for ${serviceName}`,
    steps: [
      {
        action: "check_environment",
        params: { service: serviceName, variables: envKeys },
        expected: { all_present: true },
      },
    ],
    metadata: createGeneratedMetadata(),
  };
}

/**
 * Generate volume mount test case
 */
function generateVolumeMountTest(
  serviceName: string,
  namespace: string,
  volume: { name: string; path: string },
): TestCase {
  return {
    name: `${serviceName}_volume_${volume.name}_mounted`,
    namespace,
    description: `Verify ${volume.name} volume is mounted at ${volume.path}`,
    steps: [
      {
        action: "check_volume_mount",
        params: { service: serviceName, path: volume.path, volume: volume.name },
        expected: { mounted: true, writable: true },
      },
    ],
    metadata: createGeneratedMetadata(),
  };
}

/**
 * Generate image version test case
 */
function generateImageVersionTest(
  serviceName: string,
  namespace: string,
  image: string | undefined,
): TestCase {
  return {
    name: `${serviceName}_image_version`,
    namespace,
    description: `Verify ${serviceName} is running expected image`,
    steps: [
      {
        action: "check_image",
        params: { service: serviceName, expectedImage: image },
        expected: { image_matches: true },
      },
    ],
    metadata: createGeneratedMetadata(),
  };
}

/**
 * Generate all test cases for a single service
 */
function generateServiceTestCases(service: DeploymentServiceConfig, namespace: string): TestCase[] {
  const testCases: TestCase[] = [];

  if (service.ports && service.ports.length > 0) {
    testCases.push(generateHealthCheckTest(service.name, namespace, service.ports[0].port));
    for (const port of service.ports) {
      testCases.push(generatePortConnectivityTest(service.name, namespace, port));
    }
  }

  if (service.env && Object.keys(service.env).length > 0) {
    testCases.push(generateEnvVarsTest(service.name, namespace, Object.keys(service.env)));
  }

  if (service.volumes && service.volumes.length > 0) {
    for (const volume of service.volumes) {
      testCases.push(generateVolumeMountTest(service.name, namespace, volume));
    }
  }

  if (service.artifactType === "external") {
    testCases.push(generateImageVersionTest(service.name, namespace, service.image));
  }

  return testCases;
}

/**
 * Generate test cases for services based on their configuration
 */
export function generateServiceTests(
  services: DeploymentServiceConfig[],
  specName: string,
): TestSuite[] {
  const testSuites: TestSuite[] = [];
  const engine = new TestCompositionEngine(specName);

  for (const service of services) {
    const namespace = engine.generateTestNamespace(service.name);
    const testCases = generateServiceTestCases(service, namespace);

    if (testCases.length > 0) {
      testSuites.push({
        name: `${service.name}_tests`,
        namespace,
        cases: testCases,
        setup: [{ action: "wait_for_service", params: { service: service.name, timeout: 30000 } }],
        teardown: [],
      });
    }
  }

  return testSuites;
}

const TEST_FILE_EXTENSIONS: Record<string, string> = {
  typescript: "test.ts",
  javascript: "test.js",
  python: "test.py",
  rust: "rs",
  go: "go",
};

function getTestFileExtension(language: string): string {
  return TEST_FILE_EXTENSIONS[language] ?? "test.js";
}

type TestContentGenerator = (suite: TestSuite) => string;

const TEST_CONTENT_GENERATORS: Record<string, TestContentGenerator> = {
  typescript: generateJavaScriptTestContent,
  javascript: generateJavaScriptTestContent,
  python: generatePythonTestContent,
  rust: generateRustTestContent,
  go: generateGoTestContent,
};

export function generateTestFileContent(suite: TestSuite, language: string): string {
  const generator = TEST_CONTENT_GENERATORS[language] ?? generateJavaScriptTestContent;
  return generator(suite);
}

function generateJavaScriptTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('${suite.name}', () => {
${
  suite.setup && suite.setup.length > 0
    ? `  beforeAll(async () => {
${suite.setup.map((step) => `    // ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
  });

`
    : ""
}${suite.cases
  .map(
    (testCase) => `  test('${testCase.name}', async () => {
    // ${testCase.description || "Generated test"}
${testCase.steps
  .map(
    (step) => `    // ${step.action}: ${JSON.stringify(step.params)}
    // Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}

    // TODO: Implement test logic
    expect(true).toBe(true); // Placeholder
  });`,
  )
  .join("\n\n")}
${
  suite.teardown && suite.teardown.length > 0
    ? `
  afterAll(async () => {
${suite.teardown.map((step) => `    // ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
  });`
    : ""
}
});
`;
}

function generatePythonTestContent(suite: TestSuite): string {
  return `"""${suite.name} - Generated by Arbiter
Namespace: ${suite.namespace}
Generated: ${new Date().toISOString()}
"""

import pytest
import asyncio
from typing import Dict, Any


class Test${suite.name.replace(/_/g, "")}:
    """Test suite for ${suite.name}"""
${
  suite.setup && suite.setup.length > 0
    ? `
    @pytest.fixture(scope="class", autouse=True)
    async def setup_class(self):
        """Setup for test class"""
${suite.setup.map((step) => `        # ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
        pass
`
    : ""
}
${suite.cases
  .map(
    (
      testCase,
    ) => `    async def test_${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}(self):
        """${testCase.description || "Generated test"}"""
${testCase.steps
  .map(
    (step) => `        # ${step.action}: ${JSON.stringify(step.params)}
        # Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}

        # TODO: Implement test logic
        assert True  # Placeholder`,
  )
  .join("\n\n")}
${
  suite.teardown && suite.teardown.length > 0
    ? `
    @pytest.fixture(scope="class", autouse=True)
    async def teardown_class(self):
        """Teardown for test class"""
${suite.teardown.map((step) => `        # ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
        pass`
    : ""
}
`;
}

function generateRustTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

#[cfg(test)]
mod ${suite.name.replace(/-/g, "_")} {
    use super::*;
    use tokio_test;

${suite.cases
  .map(
    (testCase) => `    #[tokio::test]
    async fn ${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}() {
        // ${testCase.description || "Generated test"}
${testCase.steps
  .map(
    (step) => `        // ${step.action}: ${JSON.stringify(step.params)}
        // Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}

        // TODO: Implement test logic
        assert!(true); // Placeholder
    }`,
  )
  .join("\n\n")}
}
`;
}

function generateGoTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

package main

import (
    "testing"
    "context"
    "time"
)

${suite.cases
  .map(
    (testCase) => `func Test${testCase.name.replace(/[^a-zA-Z0-9]/g, "")}(t *testing.T) {
    // ${testCase.description || "Generated test"}
${testCase.steps
  .map(
    (step) => `    // ${step.action}: ${JSON.stringify(step.params)}
    // Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}

    // TODO: Implement test logic
    if true != true { // Placeholder
        t.Errorf("Test failed")
    }
}`,
  )
  .join("\n\n")}
`;
}

/**
 * Write test composition results to files
 */
export async function writeTestFiles(
  testResult: TestCompositionResult,
  outputDir: string,
  language: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig = DEFAULT_PROJECT_STRUCTURE,
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);
  const testsDir = path.join(outputDir, ...effectiveTestSegments);

  if (!fs.existsSync(testsDir) && !options.dryRun) {
    await fs.mkdir(testsDir, { recursive: true });
  }

  for (const suite of testResult.merged) {
    const fileName = `${suite.name}.${getTestFileExtension(language)}`;
    const filePath = path.join(testsDir, fileName);
    const content = generateTestFileContent(suite, language);
    await writeFileWithHooks(filePath, content, options);
    files.push(joinRelativePath(testsDirRelative, fileName));
  }

  const reportPath = path.join(testsDir, "composition_report.json");
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResult.merged.reduce((sum, suite) => sum + suite.cases.length, 0),
      generatedTests: testResult.generated.length,
      preservedTests: testResult.preserved.length,
      conflicts: testResult.conflicts.length,
    },
    details: {
      conflicts: testResult.conflicts,
      generated: testResult.generated.map((t) => ({ name: t.name, namespace: t.namespace })),
      preserved: testResult.preserved.map((t) => ({ name: t.name, namespace: t.namespace })),
    },
  };

  await writeFileWithHooks(reportPath, JSON.stringify(report, null, 2), options);
  files.push(joinRelativePath(testsDirRelative, "composition_report.json"));

  return files;
}

/**
 * Report test composition results
 */
export function reportTestComposition(testResult: TestCompositionResult): void {
  reporter.info("\n📋 Test Composition Summary:");
  reporter.info(`  Generated: ${testResult.generated.length} test cases`);
  reporter.info(`  Preserved: ${testResult.preserved.length} existing test cases`);
  reporter.info(`  Conflicts: ${testResult.conflicts.length} resolved`);

  if (testResult.conflicts.length > 0) {
    reporter.info("\n⚠️  Test Conflicts Resolved:");
    testResult.conflicts.forEach((conflict) => {
      reporter.info(`  • ${conflict.test}: ${conflict.reason} (${conflict.resolution})`);
    });
  }
}

/**
 * Handle test generation errors
 */
export function handleTestGenerationError(error: unknown): string[] {
  reporter.warn(
    `⚠️  Test generation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  return [];
}
