import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import yaml from "js-yaml";

/**
 * Unified test harness for Epic v2 test execution
 * Supports static analysis, property tests, golden file tests, and CLI tests
 */

export interface TestOptions {
  epic?: string;
  types?: string[];
  junit?: string;
  timeout?: number;
  verbose?: boolean;
  parallel?: boolean;
  updateGolden?: boolean;
}

export interface TestResult {
  name: string;
  type: "static" | "property" | "golden" | "cli";
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
}

/**
 * Strategy interface for different test execution strategies
 */
export interface TestRunner {
  readonly type: string;
  readonly displayName: string;
  canExecute(testConfig: any[]): boolean;
  execute(testConfig: any[], context: TestExecutionContext): Promise<TestResult[]>;
}

/**
 * Context passed to test runners containing shared configuration
 */
export interface TestExecutionContext {
  apiUrl: string;
  timeout: number;
  verbose: boolean;
  updateGolden?: boolean;
}

/**
 * Configuration loaded from epic files
 */
export interface EpicTestConfig {
  static?: Array<{ selector: string }>;
  property?: Array<{ name: string; cue: string }>;
  golden?: Array<{ input: string; want: string }>;
  cli?: Array<{ cmd: string; expectExit: number; expectRE?: string }>;
}

/**
 * Abstract base class implementing Template Method pattern for test execution
 */
abstract class BaseTestRunner implements TestRunner {
  abstract readonly type: string;
  abstract readonly displayName: string;

  canExecute(testConfig: any[]): boolean {
    return testConfig && testConfig.length > 0;
  }

  async execute(testConfig: any[], context: TestExecutionContext): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of testConfig) {
      console.log(chalk.dim(`  ${this.getTestDescription(test)}`));
      const result = await this.executeTest(test, context);
      results.push(result);
      this.displayResult(result, context.verbose);
    }

    return results;
  }

  protected abstract getTestDescription(test: any): string;
  protected abstract executeTest(test: any, context: TestExecutionContext): Promise<TestResult>;

  protected displayResult(result: TestResult, verbose: boolean): void {
    if (result.passed) {
      console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`));
    } else {
      console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`));
      if (verbose && result.error) {
        console.log(chalk.red(`    ${result.error}`));
      }
    }
  }
}

/**
 * Static analysis test runner
 */
class StaticTestRunner extends BaseTestRunner {
  readonly type = "static";
  readonly displayName = "Static Analysis";

  protected getTestDescription(test: { selector: string }): string {
    return `Analyzing: ${test.selector}`;
  }

  protected async executeTest(
    test: { selector: string },
    context: TestExecutionContext,
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Find files matching selector
      const { glob } = await import("glob");
      const files = await glob(test.selector);

      if (files.length === 0) {
        return {
          name: `Static: ${test.selector}`,
          type: "static",
          passed: false,
          duration: Date.now() - startTime,
          error: "No files found matching selector",
        };
      }

      // Analyze each file
      const errors: string[] = [];

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");

          const response = await fetch(`${context.apiUrl}/analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content, filename: file }),
            signal: AbortSignal.timeout(context.timeout),
          });

          if (!response.ok) {
            errors.push(`${file}: HTTP ${response.status}`);
            continue;
          }

          const result = await response.json();

          // Check for CUE errors (bottom values or validation errors)
          if (result.errors && result.errors.length > 0) {
            errors.push(`${file}: ${result.errors.map((e: any) => e.message).join(", ")}`);
          }
        } catch (error) {
          errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        name: `Static: ${test.selector}`,
        type: "static",
        passed: errors.length === 0,
        duration: Date.now() - startTime,
        error: errors.length > 0 ? errors.join("; ") : undefined,
        details: { filesAnalyzed: files.length, errors },
      };
    } catch (error) {
      return {
        name: `Static: ${test.selector}`,
        type: "static",
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Property test runner
 */
class PropertyTestRunner extends BaseTestRunner {
  readonly type = "property";
  readonly displayName = "Property Tests";

  protected getTestDescription(test: { name: string }): string {
    return `Testing: ${test.name}`;
  }

  protected async executeTest(
    test: { name: string; cue: string },
    context: TestExecutionContext,
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Create a simple CUE document to evaluate the expression
      const cueContent = `
package test

result: ${test.cue}
`;

      const response = await fetch(`${context.apiUrl}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: cueContent,
          filename: `property-${test.name}.cue`,
        }),
        signal: AbortSignal.timeout(context.timeout),
      });

      if (!response.ok) {
        return {
          name: `Property: ${test.name}`,
          type: "property",
          passed: false,
          duration: Date.now() - startTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const result = await response.json();

      // Check if evaluation succeeded and result is true
      const passed = result.errors.length === 0 && result.value && result.value.result === true;

      return {
        name: `Property: ${test.name}`,
        type: "property",
        passed,
        duration: Date.now() - startTime,
        error: passed ? undefined : "Property evaluation failed or returned false",
        details: { expression: test.cue, result: result.value },
      };
    } catch (error) {
      return {
        name: `Property: ${test.name}`,
        type: "property",
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Golden file test runner
 */
class GoldenTestRunner extends BaseTestRunner {
  readonly type = "golden";
  readonly displayName = "Golden Tests";

  protected getTestDescription(test: { input: string; want: string }): string {
    return `Comparing: ${test.input} → ${test.want}`;
  }

  protected async executeTest(
    test: { input: string; want: string },
    context: TestExecutionContext,
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Read input file
      const inputContent = await fs.readFile(test.input, "utf-8");

      // Analyze input to get output
      const response = await fetch(`${context.apiUrl}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: inputContent,
          filename: test.input,
        }),
        signal: AbortSignal.timeout(context.timeout),
      });

      if (!response.ok) {
        return {
          name: `Golden: ${path.basename(test.input)}`,
          type: "golden",
          passed: false,
          duration: Date.now() - startTime,
          error: `Analysis failed: HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      const actualOutput = JSON.stringify(result, null, 2);

      if (context.updateGolden) {
        // Update golden file
        await fs.mkdir(path.dirname(test.want), { recursive: true });
        await fs.writeFile(test.want, actualOutput);

        return {
          name: `Golden: ${path.basename(test.input)} (updated)`,
          type: "golden",
          passed: true,
          duration: Date.now() - startTime,
          details: { updated: true },
        };
      }

      // Compare with expected output
      let expectedOutput: string;
      try {
        expectedOutput = await fs.readFile(test.want, "utf-8");
      } catch (_error) {
        return {
          name: `Golden: ${path.basename(test.input)}`,
          type: "golden",
          passed: false,
          duration: Date.now() - startTime,
          error: `Golden file not found: ${test.want}`,
        };
      }

      // Normalize whitespace for comparison
      const actualNormalized = actualOutput.trim().replace(/\s+/g, " ");
      const expectedNormalized = expectedOutput.trim().replace(/\s+/g, " ");

      const passed = actualNormalized === expectedNormalized;

      return {
        name: `Golden: ${path.basename(test.input)}`,
        type: "golden",
        passed,
        duration: Date.now() - startTime,
        error: passed ? undefined : "Output does not match golden file",
        details: {
          expected: expectedOutput.slice(0, 200),
          actual: actualOutput.slice(0, 200),
        },
      };
    } catch (error) {
      return {
        name: `Golden: ${path.basename(test.input)}`,
        type: "golden",
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * CLI test runner
 */
class CliTestRunner extends BaseTestRunner {
  readonly type = "cli";
  readonly displayName = "CLI Tests";

  protected getTestDescription(test: { cmd: string }): string {
    return `Executing: ${test.cmd}`;
  }

  protected async executeTest(
    test: { cmd: string; expectExit: number; expectRE?: string },
    context: TestExecutionContext,
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const [command, ...args] = test.cmd.split(" ");

      return new Promise((resolve) => {
        const proc = spawn(command, args, {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: context.timeout,
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          const duration = Date.now() - startTime;

          if (code !== test.expectExit) {
            resolve({
              name: `CLI: ${test.cmd}`,
              type: "cli",
              passed: false,
              duration,
              error: `Expected exit code ${test.expectExit}, got ${code}. stderr: ${stderr}`,
              details: { stdout, stderr, exitCode: code },
            });
            return;
          }

          if (test.expectRE && !new RegExp(test.expectRE).test(stdout)) {
            resolve({
              name: `CLI: ${test.cmd}`,
              type: "cli",
              passed: false,
              duration,
              error: `Output didn't match expected regex: ${test.expectRE}`,
              details: { stdout, stderr, expectRE: test.expectRE },
            });
            return;
          }

          resolve({
            name: `CLI: ${test.cmd}`,
            type: "cli",
            passed: true,
            duration,
            details: { stdout, stderr, exitCode: code },
          });
        });

        proc.on("error", (error) => {
          resolve({
            name: `CLI: ${test.cmd}`,
            type: "cli",
            passed: false,
            duration: Date.now() - startTime,
            error: error.message,
          });
        });
      });
    } catch (error) {
      return {
        name: `CLI: ${test.cmd}`,
        type: "cli",
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * Epic test configuration loader
 */
class EpicTestLoader {
  async loadTests(epicPath: string): Promise<EpicTestConfig> {
    try {
      const content = await fs.readFile(epicPath, "utf-8");

      let epic: any;
      try {
        epic = JSON.parse(content);
      } catch {
        epic = yaml.load(content);
      }

      if (!epic.tests) {
        throw new Error("Epic has no test configuration");
      }

      return epic.tests;
    } catch (error) {
      throw new Error(
        `Failed to load epic tests: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Test report generator for various output formats
 */
class TestReportGenerator {
  generateJUnitXML(suites: TestSuite[]): string {
    const totalTests = suites.reduce((sum, suite) => sum + suite.summary.total, 0);
    const totalFailures = suites.reduce((sum, suite) => sum + suite.summary.failed, 0);
    const totalTime = suites.reduce((sum, suite) => sum + suite.summary.duration, 0) / 1000;

    const testsuites = suites
      .map((suite) => {
        const testcases = suite.results
          .map(
            (result) => `
    <testcase 
      classname="${suite.name}" 
      name="${result.name}" 
      time="${result.duration / 1000}">
      ${result.passed ? "" : `<failure message="${result.error || "Test failed"}">${result.error || "Test failed"}</failure>`}
    </testcase>`,
          )
          .join("");

        return `
  <testsuite 
    name="${suite.name}" 
    tests="${suite.summary.total}" 
    failures="${suite.summary.failed}" 
    time="${suite.summary.duration / 1000}">
    ${testcases}
  </testsuite>`;
      })
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${totalTests}" failures="${totalFailures}" time="${totalTime}">
  ${testsuites}
</testsuites>`;
  }

  displaySummary(suites: TestSuite[], totalDuration: number): void {
    const totalTests = suites.reduce((sum, suite) => sum + suite.summary.total, 0);
    const totalPassed = suites.reduce((sum, suite) => sum + suite.summary.passed, 0);
    const totalFailed = totalTests - totalPassed;

    console.log(chalk.blue("\n📊 Test Summary:"));

    for (const suite of suites) {
      console.log(chalk.cyan(`  ${suite.name}:`));
      console.log(`    Tests: ${suite.summary.passed}/${suite.summary.total} passed`);
      console.log(`    Duration: ${suite.summary.duration}ms`);
    }

    console.log(chalk.blue("\n🏁 Overall:"));
    console.log(`  Total tests: ${totalTests}`);
    console.log(`  Passed: ${chalk.green(totalPassed)}`);
    console.log(`  Failed: ${totalFailed > 0 ? chalk.red(totalFailed) : totalFailed}`);
    console.log(`  Duration: ${totalDuration}ms`);
    console.log(`  Success rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
  }
}

/**
 * Factory for creating test runners using Factory Pattern
 */
class TestRunnerFactory {
  private static runners: Map<string, TestRunner> = new Map<string, TestRunner>([
    ["static", new StaticTestRunner()],
    ["property", new PropertyTestRunner()],
    ["golden", new GoldenTestRunner()],
    ["cli", new CliTestRunner()],
  ]);

  static getRunner(type: string): TestRunner | undefined {
    return TestRunnerFactory.runners.get(type);
  }

  static getAllRunnerTypes(): string[] {
    return Array.from(TestRunnerFactory.runners.keys());
  }
}

/**
 * Test suite executor orchestrating test execution using Chain of Responsibility
 */
class TestSuiteExecutor {
  private runners: TestRunner[] = [];
  private context: TestExecutionContext;
  private reportGenerator: TestReportGenerator;

  constructor(context: TestExecutionContext) {
    this.context = context;
    this.reportGenerator = new TestReportGenerator();
  }

  addRunner(runner: TestRunner): void {
    this.runners.push(runner);
  }

  async execute(epicConfig: EpicTestConfig, requestedTypes: string[]): Promise<TestSuite[]> {
    const suites: TestSuite[] = [];

    for (const runner of this.runners) {
      if (!requestedTypes.includes(runner.type)) {
        continue;
      }

      const testConfig = this.getTestConfigForRunner(runner.type, epicConfig);
      if (!runner.canExecute(testConfig)) {
        continue;
      }

      console.log(
        chalk.blue(
          `\n${this.getTestIcon(runner.type)} Running ${runner.displayName.toLowerCase()}...`,
        ),
      );

      const results = await runner.execute(testConfig, this.context);

      const suite: TestSuite = {
        name: runner.displayName,
        results,
        summary: {
          total: results.length,
          passed: results.filter((r) => r.passed).length,
          failed: results.filter((r) => !r.passed).length,
          duration: results.reduce((sum, r) => sum + r.duration, 0),
        },
      };

      suites.push(suite);
    }

    return suites;
  }

  private getTestConfigForRunner(type: string, epicConfig: EpicTestConfig): any[] {
    switch (type) {
      case "static":
        return epicConfig.static || [];
      case "property":
        return epicConfig.property || [];
      case "golden":
        return epicConfig.golden || [];
      case "cli":
        return epicConfig.cli || [];
      default:
        return [];
    }
  }

  private getTestIcon(type: string): string {
    const icons: Record<string, string> = {
      static: "📊",
      property: "🔍",
      golden: "🏆",
      cli: "🖥️",
    };
    return icons[type] || "🧪";
  }

  displaySummary(suites: TestSuite[], totalDuration: number): void {
    this.reportGenerator.displaySummary(suites, totalDuration);
  }

  generateJUnitReport(suites: TestSuite[]): string {
    return this.reportGenerator.generateJUnitXML(suites);
  }
}

/**
 * Simplified main test command using all the refactored components
 */
export async function testCommand(options: TestOptions): Promise<number> {
  const startTime = Date.now();
  const apiUrl = "http://localhost:8080"; // Should be configurable
  const timeout = options.timeout || 30000;
  const types = options.types || ["static", "property", "golden", "cli"];

  console.log(chalk.blue("🧪 Running unified test harness"));

  try {
    if (!options.epic) {
      console.log(chalk.yellow("No epic specified - skipping tests"));
      return 0;
    }

    // Load epic configuration
    console.log(chalk.cyan(`📋 Loading tests from epic: ${options.epic}`));
    const epicLoader = new EpicTestLoader();
    const epicConfig = await epicLoader.loadTests(options.epic);

    // Set up test execution context
    const context: TestExecutionContext = {
      apiUrl,
      timeout,
      verbose: options.verbose || false,
      updateGolden: options.updateGolden,
    };

    // Configure test suite executor
    const executor = new TestSuiteExecutor(context);

    // Add runners for requested test types using Chain of Responsibility
    for (const type of types) {
      const runner = TestRunnerFactory.getRunner(type);
      if (runner) {
        executor.addRunner(runner);
      }
    }

    // Execute all test suites
    const suites = await executor.execute(epicConfig, types);

    // Display results and generate reports
    const totalDuration = Date.now() - startTime;
    executor.displaySummary(suites, totalDuration);

    // Write JUnit XML if requested
    if (options.junit) {
      const junitXml = executor.generateJUnitReport(suites);
      await fs.writeFile(options.junit, junitXml);
      console.log(chalk.dim(`\nJUnit report written to: ${options.junit}`));
    }

    // Return appropriate exit code
    const totalFailed = suites.reduce((sum, suite) => sum + suite.summary.failed, 0);
    return totalFailed === 0 ? 0 : 1;
  } catch (error) {
    console.error(
      chalk.red("❌ Test execution failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}
