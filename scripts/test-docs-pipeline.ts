#!/usr/bin/env bun

/**
 * Documentation Pipeline Testing and Validation
 *
 * Comprehensive testing suite for the documentation generation pipeline.
 * Tests all generators, orchestration, monitoring, and validation systems.
 */

import { spawn } from "child_process";
import * as path from "path";
import chalk from "chalk";
import { program } from "commander";
import * as fs from "fs-extra";
import { glob } from "glob";

interface TestOptions {
  "test-generators"?: boolean;
  "test-orchestration"?: boolean;
  "test-monitoring"?: boolean;
  "test-validation"?: boolean;
  "test-integration"?: boolean;
  "smoke-test"?: boolean;
  "load-test"?: boolean;
  "clean-artifacts"?: boolean;
  verbose?: boolean;
  "dry-run"?: boolean;
  timeout?: number;
}

interface TestResult {
  name: string;
  type: "generator" | "orchestration" | "monitoring" | "validation" | "integration";
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  artifacts?: string[];
}

interface TestSuite {
  name: string;
  results: TestResult[];
  startTime: Date;
  endTime: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  duration: number;
  coverage: {
    generators: number;
    orchestration: number;
    monitoring: number;
    validation: number;
  };
}

export async function main(): Promise<void> {
  program
    .name("test-docs-pipeline")
    .description("Test the documentation generation pipeline")
    .version("1.0.0")
    .option("--test-generators", "test individual documentation generators")
    .option("--test-orchestration", "test orchestration system")
    .option("--test-monitoring", "test monitoring system")
    .option("--test-validation", "test validation system")
    .option("--test-integration", "test end-to-end integration")
    .option("--smoke-test", "run quick smoke tests")
    .option("--load-test", "run load tests")
    .option("--clean-artifacts", "clean test artifacts after completion")
    .option("-v, --verbose", "verbose output")
    .option("--dry-run", "preview tests without executing")
    .option("-t, --timeout <ms>", "test timeout in milliseconds", "120000")
    .action(async (options: TestOptions) => {
      try {
        const exitCode = await runDocumentationTests(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          chalk.red("Documentation testing failed:"),
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  program
    .command("validate-config")
    .description("validate documentation configuration")
    .option("-c, --config <path>", "configuration file path", "./docs/config/docs-config.yaml")
    .action(async (options) => {
      try {
        const isValid = await validateConfiguration(options.config);
        process.exit(isValid ? 0 : 1);
      } catch (error) {
        console.error(chalk.red("Configuration validation failed:"), error);
        process.exit(1);
      }
    });

  program
    .command("benchmark")
    .description("benchmark documentation generation performance")
    .option("-i, --iterations <num>", "number of iterations", "5")
    .option("--baseline", "establish baseline metrics")
    .action(async (options) => {
      try {
        const exitCode = await runBenchmarks(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(chalk.red("Benchmarking failed:"), error);
        process.exit(1);
      }
    });

  program.parse();
}

async function runDocumentationTests(options: TestOptions): Promise<number> {
  console.log(chalk.blue("🧪 Documentation Pipeline Testing Suite"));
  console.log(chalk.dim(`Timeout: ${options.timeout}ms`));

  const startTime = new Date();
  const testResults: TestResult[] = [];

  // Prepare test environment
  await setupTestEnvironment();

  // Determine which tests to run
  const testSuites = getTestSuites(options);
  console.log(chalk.blue(`📋 Running ${testSuites.length} test suite(s)`));

  // Run test suites
  for (const suiteName of testSuites) {
    console.log(chalk.blue(`\n🔧 Running ${suiteName} tests...`));

    const suiteResults = await runTestSuite(suiteName, options);
    testResults.push(...suiteResults);
  }

  // Run integration tests if requested
  if (options["test-integration"]) {
    console.log(chalk.blue("\n🔗 Running integration tests..."));
    const integrationResults = await runIntegrationTests(options);
    testResults.push(...integrationResults);
  }

  // Run smoke tests if requested
  if (options["smoke-test"]) {
    console.log(chalk.blue("\n💨 Running smoke tests..."));
    const smokeResults = await runSmokeTests(options);
    testResults.push(...smokeResults);
  }

  // Run load tests if requested
  if (options["load-test"]) {
    console.log(chalk.blue("\n⚡ Running load tests..."));
    const loadResults = await runLoadTests(options);
    testResults.push(...loadResults);
  }

  const endTime = new Date();

  // Generate test report
  const testSuite: TestSuite = {
    name: "Documentation Pipeline Tests",
    results: testResults,
    startTime,
    endTime,
    totalTests: testResults.length,
    passedTests: testResults.filter((r) => r.success).length,
    failedTests: testResults.filter((r) => !r.success).length,
    duration: endTime.getTime() - startTime.getTime(),
    coverage: calculateTestCoverage(testResults),
  };

  // Print results
  printTestReport(testSuite, options.verbose);

  // Save test results
  await saveTestResults(testSuite);

  // Clean up if requested
  if (options["clean-artifacts"]) {
    await cleanupTestArtifacts();
  }

  return testSuite.failedTests === 0 ? 0 : 1;
}

function getTestSuites(options: TestOptions): string[] {
  const suites: string[] = [];

  if (options["test-generators"]) suites.push("generators");
  if (options["test-orchestration"]) suites.push("orchestration");
  if (options["test-monitoring"]) suites.push("monitoring");
  if (options["test-validation"]) suites.push("validation");

  // If no specific tests requested, run all
  if (suites.length === 0) {
    suites.push("generators", "orchestration", "monitoring", "validation");
  }

  return suites;
}

async function setupTestEnvironment(): Promise<void> {
  // Create test directories
  await fs.ensureDir("./test-output");
  await fs.ensureDir("./test-output/docs");
  await fs.ensureDir("./test-output/logs");
  await fs.ensureDir("./test-output/artifacts");

  // Copy test fixtures
  if (await fs.pathExists("./test/fixtures")) {
    await fs.copy("./test/fixtures", "./test-output/fixtures");
  }

  // Create minimal test configuration
  const testConfig = {
    version: "1.0.0",
    enabled: true,
    pipeline: {
      cli: { enabled: true, timeout: 30000, parallel: true, priority: 1 },
      cue: { enabled: true, timeout: 30000, parallel: true, priority: 2 },
      api: { enabled: true, timeout: 30000, parallel: true, priority: 3 },
      codegen: { enabled: true, timeout: 30000, parallel: true, priority: 4 },
      project: { enabled: true, timeout: 30000, parallel: false, priority: 5 },
    },
    outputs: { baseDir: "./test-output/docs", formats: ["markdown", "json"] },
    validation: { enabled: true, failOnError: false },
  };

  await fs.writeFile("./test-output/test-config.yaml", JSON.stringify(testConfig, null, 2), "utf8");
}

async function runTestSuite(suiteName: string, options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  switch (suiteName) {
    case "generators":
      results.push(...(await testGenerators(options)));
      break;
    case "orchestration":
      results.push(...(await testOrchestration(options)));
      break;
    case "monitoring":
      results.push(...(await testMonitoring(options)));
      break;
    case "validation":
      results.push(...(await testValidation(options)));
      break;
  }

  return results;
}

async function testGenerators(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const generators = [
    { name: "CLI Documentation Generator", script: "scripts/docs-generators/cue-schema-docs.ts" },
    { name: "CUE Schema Generator", script: "scripts/docs-generators/cue-schema-docs.ts" },
    { name: "API Documentation Generator", script: "scripts/docs-generators/api-docs.ts" },
    { name: "Code Generation Generator", script: "scripts/docs-generators/codegen-docs.ts" },
    { name: "Project Documentation Generator", script: "scripts/docs-generators/project-docs.ts" },
  ];

  for (const generator of generators) {
    const result = await runSingleTest(generator.name, "generator", async () => {
      const output = await execCommand(
        "bun",
        [generator.script, "--output=./test-output/docs", "--dry-run"],
        { timeout: Number(options.timeout) },
      );

      return output;
    });

    results.push(result);

    if (options.verbose) {
      console.log(
        chalk.dim(`  ${result.success ? "✅" : "❌"} ${result.name} (${result.duration}ms)`),
      );
    }
  }

  return results;
}

async function testOrchestration(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test orchestrator initialization
  results.push(
    await runSingleTest("Orchestrator Initialization", "orchestration", async () => {
      return await execCommand("bun", ["scripts/docs-orchestrator.ts", "init", "--template=test"], {
        timeout: Number(options.timeout),
      });
    }),
  );

  // Test orchestrator status
  results.push(
    await runSingleTest("Orchestrator Status Check", "orchestration", async () => {
      return await execCommand(
        "bun",
        ["scripts/docs-orchestrator.ts", "status", "--config=./test-output/test-config.yaml"],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  // Test orchestrator dry run
  results.push(
    await runSingleTest("Orchestrator Dry Run", "orchestration", async () => {
      return await execCommand(
        "bun",
        [
          "scripts/docs-orchestrator.ts",
          "--config=./test-output/test-config.yaml",
          "--dry-run",
          "--types=project",
        ],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  return results;
}

async function testMonitoring(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test health check
  results.push(
    await runSingleTest("Health Check", "monitoring", async () => {
      return await execCommand(
        "bun",
        ["scripts/docs-monitor.ts", "health", "--config=./test-output/test-config.yaml"],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  // Test monitoring with checks
  results.push(
    await runSingleTest("Monitoring Checks", "monitoring", async () => {
      return await execCommand(
        "bun",
        [
          "scripts/docs-monitor.ts",
          "--check-freshness",
          "--check-quality",
          "--config=./test-output/test-config.yaml",
        ],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  // Test auto-fix
  results.push(
    await runSingleTest("Auto-fix", "monitoring", async () => {
      return await execCommand(
        "bun",
        ["scripts/docs-monitor.ts", "fix", "--dry-run", "--config=./test-output/test-config.yaml"],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  return results;
}

async function testValidation(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test configuration validation
  results.push(
    await runSingleTest("Configuration Validation", "validation", async () => {
      return await execCommand(
        "bun",
        [
          "scripts/test-docs-pipeline.ts",
          "validate-config",
          "--config=./test-output/test-config.yaml",
        ],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  // Test pipeline validation
  results.push(
    await runSingleTest("Pipeline Validation", "validation", async () => {
      return await execCommand(
        "bun",
        ["scripts/docs-orchestrator.ts", "validate", "--config=./test-output/test-config.yaml"],
        { timeout: Number(options.timeout) },
      );
    }),
  );

  return results;
}

async function runIntegrationTests(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test full pipeline integration
  results.push(
    await runSingleTest("Full Pipeline Integration", "integration", async () => {
      // Run a complete pipeline with minimal configuration
      return await execCommand(
        "bun",
        [
          "scripts/docs-orchestrator.ts",
          "--config=./test-output/test-config.yaml",
          "--types=project",
          "--skip-deployment",
          "--dry-run",
        ],
        { timeout: Number(options.timeout) * 2 },
      ); // Give integration tests more time
    }),
  );

  // Test pipeline with validation
  results.push(
    await runSingleTest("Pipeline with Validation", "integration", async () => {
      return await execCommand("bun", ["run", "docs:validate"], {
        timeout: Number(options.timeout),
      });
    }),
  );

  return results;
}

async function runSmokeTests(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Quick smoke test of key commands
  const smokeTests = [
    { name: "CLI Help", command: ["scripts/docs-orchestrator.ts", "--help"] },
    { name: "Monitor Help", command: ["scripts/docs-monitor.ts", "--help"] },
    {
      name: "Config Init",
      command: ["scripts/docs-orchestrator.ts", "init", "--template=default"],
    },
    { name: "Status Check", command: ["scripts/docs-orchestrator.ts", "status"] },
  ];

  for (const test of smokeTests) {
    results.push(
      await runSingleTest(`Smoke: ${test.name}`, "integration", async () => {
        return await execCommand("bun", test.command, { timeout: 10000 });
      }),
    );
  }

  return results;
}

async function runLoadTests(options: TestOptions): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test concurrent documentation generation
  results.push(
    await runSingleTest("Concurrent Generation Load Test", "integration", async () => {
      const promises = [];
      const concurrency = 3;

      for (let i = 0; i < concurrency; i++) {
        promises.push(
          execCommand(
            "bun",
            [
              "scripts/docs-generators/project-docs.ts",
              "--dry-run",
              `--output=./test-output/docs-${i}`,
            ],
            { timeout: Number(options.timeout) },
          ),
        );
      }

      await Promise.all(promises);
      return "Concurrent generation test completed";
    }),
  );

  // Test rapid successive calls
  results.push(
    await runSingleTest("Rapid Successive Calls", "integration", async () => {
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        await execCommand(
          "bun",
          ["scripts/docs-orchestrator.ts", "status", "--config=./test-output/test-config.yaml"],
          { timeout: 5000 },
        );
      }

      return `${iterations} rapid calls completed`;
    }),
  );

  return results;
}

async function runSingleTest(
  name: string,
  type: TestResult["type"],
  testFunction: () => Promise<string>,
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const output = await testFunction();
    const duration = Date.now() - startTime;

    return {
      name,
      type,
      success: true,
      duration,
      output,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      name,
      type,
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function execCommand(
  command: string,
  args: string[],
  options: { timeout?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Command timeout after ${options.timeout}ms`));
    }, options.timeout || 30000);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function calculateTestCoverage(results: TestResult[]): TestSuite["coverage"] {
  const byType = results.reduce(
    (acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    generators: ((byType.generator || 0) / 5) * 100, // 5 generators expected
    orchestration: ((byType.orchestration || 0) / 3) * 100, // 3 orchestration tests expected
    monitoring: ((byType.monitoring || 0) / 3) * 100, // 3 monitoring tests expected
    validation: ((byType.validation || 0) / 2) * 100, // 2 validation tests expected
  };
}

function printTestReport(testSuite: TestSuite, verbose: boolean = false): void {
  console.log(chalk.blue(`\n📊 Test Results Summary`));
  console.log(chalk.dim(`Duration: ${testSuite.duration}ms`));
  console.log(chalk.dim(`Total Tests: ${testSuite.totalTests}`));

  const passColor = testSuite.passedTests === testSuite.totalTests ? chalk.green : chalk.yellow;
  const failColor = testSuite.failedTests > 0 ? chalk.red : chalk.dim;

  console.log(passColor(`Passed: ${testSuite.passedTests}`));
  console.log(failColor(`Failed: ${testSuite.failedTests}`));

  // Coverage summary
  console.log(chalk.blue("\n📋 Test Coverage:"));
  console.log(chalk.dim(`Generators: ${testSuite.coverage.generators.toFixed(1)}%`));
  console.log(chalk.dim(`Orchestration: ${testSuite.coverage.orchestration.toFixed(1)}%`));
  console.log(chalk.dim(`Monitoring: ${testSuite.coverage.monitoring.toFixed(1)}%`));
  console.log(chalk.dim(`Validation: ${testSuite.coverage.validation.toFixed(1)}%`));

  if (verbose) {
    // Detailed results
    console.log(chalk.blue("\n📝 Detailed Results:"));

    const groupedResults = testSuite.results.reduce(
      (acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
        return acc;
      },
      {} as Record<string, TestResult[]>,
    );

    for (const [type, results] of Object.entries(groupedResults)) {
      console.log(chalk.blue(`\n${type.toUpperCase()}:`));
      for (const result of results) {
        const icon = result.success ? "✅" : "❌";
        const duration = `${result.duration}ms`;
        console.log(chalk.dim(`  ${icon} ${result.name} (${duration})`));

        if (!result.success && result.error) {
          console.log(chalk.red(`    Error: ${result.error}`));
        }
      }
    }
  }

  // Failed tests summary
  if (testSuite.failedTests > 0) {
    console.log(chalk.red("\n❌ Failed Tests:"));
    const failedTests = testSuite.results.filter((r) => !r.success);
    for (const test of failedTests) {
      console.log(chalk.red(`  - ${test.name}: ${test.error}`));
    }
  }
}

async function saveTestResults(testSuite: TestSuite): Promise<void> {
  const reportFile = "./test-output/test-report.json";
  await fs.writeFile(reportFile, JSON.stringify(testSuite, null, 2), "utf8");

  // Generate JUnit XML for CI systems
  const junitXml = generateJUnitXML(testSuite);
  await fs.writeFile("./test-output/test-results.xml", junitXml, "utf8");

  console.log(chalk.green(`\n✅ Test results saved to ${reportFile}`));
}

function generateJUnitXML(testSuite: TestSuite): string {
  const testcases = testSuite.results
    .map((result) => {
      const failure = result.success
        ? ""
        : `<failure message="${escapeXml(result.error || "Test failed")}">${escapeXml(result.error || "Unknown error")}</failure>`;

      return `    <testcase classname="${result.type}" name="${escapeXml(result.name)}" time="${result.duration / 1000}">
${failure}
    </testcase>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${testSuite.name}" tests="${testSuite.totalTests}" failures="${testSuite.failedTests}" time="${testSuite.duration / 1000}">
${testcases}
</testsuite>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function cleanupTestArtifacts(): Promise<void> {
  console.log(chalk.blue("🧹 Cleaning up test artifacts..."));

  try {
    if (await fs.pathExists("./test-output")) {
      await fs.remove("./test-output");
    }

    // Clean up any temporary files created during testing
    const tempFiles = await glob("./test-docs-*");
    for (const file of tempFiles) {
      await fs.remove(file);
    }

    console.log(chalk.green("✅ Test artifacts cleaned up"));
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Failed to clean up some artifacts: ${error}`));
  }
}

async function validateConfiguration(configPath: string): Promise<boolean> {
  console.log(chalk.blue("🔍 Validating documentation configuration..."));

  if (!(await fs.pathExists(configPath))) {
    console.error(chalk.red("❌ Configuration file not found"));
    return false;
  }

  try {
    const content = await fs.readFile(configPath, "utf8");

    // Basic YAML syntax validation
    if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
      const YAML = await import("yaml");
      YAML.parse(content);
    } else {
      JSON.parse(content);
    }

    // Schema validation would go here
    console.log(chalk.green("✅ Configuration is valid"));
    return true;
  } catch (error) {
    console.error(
      chalk.red("❌ Configuration validation failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

async function runBenchmarks(options: any): Promise<number> {
  console.log(chalk.blue("📊 Running documentation generation benchmarks..."));

  const iterations = Number(options.iterations) || 5;
  const results: number[] = [];

  for (let i = 0; i < iterations; i++) {
    console.log(chalk.blue(`🔄 Iteration ${i + 1}/${iterations}`));

    const startTime = Date.now();

    try {
      await execCommand(
        "bun",
        [
          "scripts/docs-generators/project-docs.ts",
          "--dry-run",
          `--output=./test-output/benchmark-${i}`,
        ],
        { timeout: 60000 },
      );

      const duration = Date.now() - startTime;
      results.push(duration);

      console.log(chalk.green(`  ✅ Completed in ${duration}ms`));
    } catch (error) {
      console.error(chalk.red(`  ❌ Failed: ${error}`));
      return 1;
    }
  }

  // Calculate statistics
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  const median = results.sort((a, b) => a - b)[Math.floor(results.length / 2)];

  console.log(chalk.blue("\n📊 Benchmark Results:"));
  console.log(chalk.dim(`Average: ${avg.toFixed(2)}ms`));
  console.log(chalk.dim(`Median: ${median}ms`));
  console.log(chalk.dim(`Min: ${min}ms`));
  console.log(chalk.dim(`Max: ${max}ms`));

  // Save benchmark results
  const benchmarkData = {
    timestamp: new Date().toISOString(),
    iterations,
    results,
    statistics: { avg, median, min, max },
  };

  await fs.ensureDir("./test-output");
  await fs.writeFile(
    "./test-output/benchmark-results.json",
    JSON.stringify(benchmarkData, null, 2),
    "utf8",
  );

  return 0;
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red("Script error:"), error);
    process.exit(1);
  });
}
