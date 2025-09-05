import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { diffLines } from "diff";
import yaml from "js-yaml";
import { withStepProgress } from "../utils/progress.js";
import {
  createOutputManager,
  type ExecutionReport,
  type PlanOutput,
  shouldUseAgentMode,
} from "../utils/standardized-output.js";

// Strategy interfaces for execution patterns
interface ExecutionStrategy {
  execute(plan: ExecutionPlan, options: ExecuteOptions): Promise<void>;
}

// Command interfaces for operation steps
interface Command {
  execute(): Promise<void>;
}

// Builder interface for plan construction
interface PlanBuilder {
  build(): Promise<ExecutionPlan>;
}

/**
 * Epic v2 execution engine with deterministic file-plan generation
 * Implements the agent-first, idempotent codegen approach from TODO.md
 */

export interface Epic {
  id: string;
  title: string;
  owners: string[];
  targets: Array<{
    root: string;
    include: string[];
    exclude: string[];
  }>;
  generate: Array<{
    path: string;
    mode: "create" | "patch";
    template: string;
    data: Record<string, any>;
    guards: string[];
  }>;
  contracts: {
    types: string[];
    invariants: string[];
  };
  tests: {
    static: Array<{ selector: string }>;
    property: Array<{ name: string; cue: string }>;
    golden: Array<{ input: string; want: string }>;
    cli: Array<{ cmd: string; expectExit: number; expectRE?: string }>;
  };
  rollout: {
    steps: string[];
    gates: Array<{ name: string; cue: string }>;
  };
  heuristics: {
    preferSmallPRs: boolean;
    maxFilesPerPR: number;
  };
  metadata?: {
    created?: string;
    updated?: string;
    version?: string;
    tags?: string[];
    priority?: "low" | "medium" | "high" | "critical";
    complexity?: number;
  };
}

export interface FileOperation {
  path: string;
  mode: "create" | "patch";
  content: string;
  guards: string[];
  originalExists: boolean;
  originalContent?: string;
}

export interface ExecutionPlan {
  epicId: string;
  operations: FileOperation[];
  sortedOrder: string[];
  conflicts: string[];
  guardViolations: string[];
}

export interface ExecutionSummary {
  epicId: string;
  timestamp: string;
  filesChanged: number;
  testsRun: number;
  testsPassed: number;
  contractsChecked: number;
  contractsPassed: number;
  rolloutGatesChecked: number;
  rolloutGatesPassed: number;
  overallSuccess: boolean;
  duration: number;
  results: Array<{
    name: string;
    passed: boolean;
    duration?: number;
    error?: string;
    details?: any;
  }>;
}

export interface ExecuteOptions {
  dryRun?: boolean;
  epic: string;
  workspace?: string;
  timeout?: number;
  junit?: string;
  verbose?: boolean;
  agentMode?: boolean;
  ndjsonOutput?: string;
}

/**
 * Epic loader class - Single responsibility: Loading and parsing epic files
 */
class EpicLoader {
  private epicPath: string;

  constructor(epicPath: string) {
    this.epicPath = epicPath;
  }

  async load(): Promise<Epic> {
    try {
      const content = await fs.readFile(this.epicPath, "utf-8");

      // For now, assume the epic is in JSON format or can be parsed as such
      // In a real implementation, we'd use CUE's parser
      // This is a simplified version for the prototype
      if (content.includes("package epics") || content.includes(": epics.#Epic")) {
        // CUE format - would need proper CUE parsing here
        throw new Error("CUE parsing not yet implemented - please provide JSON format for now");
      }

      // Try to parse as JSON/YAML
      let epic: Epic;
      try {
        epic = JSON.parse(content);
      } catch {
        epic = yaml.load(content) as Epic;
      }

      // Validate required fields
      this.validateEpic(epic);
      return epic;
    } catch (error) {
      throw new Error(
        `Failed to load epic from ${this.epicPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private validateEpic(epic: Epic): void {
    if (!epic.id || !epic.title || !epic.owners || !epic.generate) {
      throw new Error("Invalid epic: missing required fields (id, title, owners, generate)");
    }
  }
}

/**
 * Plan generator class - Single responsibility: Creating execution plans
 */
class PlanGenerator implements PlanBuilder {
  private epic: Epic;
  private workspace: string;

  constructor(epic: Epic, workspace: string) {
    this.epic = epic;
    this.workspace = workspace;
  }

  async build(): Promise<ExecutionPlan> {
    const operations: FileOperation[] = [];
    const conflicts: string[] = [];
    const guardViolations: string[] = [];

    for (const gen of this.epic.generate) {
      const operation = await this.createFileOperation(gen);
      operations.push(operation);

      // Check guards
      const violations = await this.checkGuards(operation.path, gen.guards);
      guardViolations.push(...violations);

      // Check for conflicts
      if (gen.mode === "create" && operation.originalExists) {
        conflicts.push(`Conflict: ${gen.path} already exists but mode is 'create'`);
      }
    }

    const sortedOrder = this.calculateSortOrder(operations);

    return {
      epicId: this.epic.id,
      operations: operations.sort(
        (a, b) => sortedOrder.indexOf(a.path) - sortedOrder.indexOf(b.path),
      ),
      sortedOrder,
      conflicts,
      guardViolations,
    };
  }

  private async createFileOperation(gen: Epic["generate"][0]): Promise<FileOperation> {
    const fullPath = path.isAbsolute(gen.path) ? gen.path : path.join(this.workspace, gen.path);

    // Check if file exists
    let originalExists = false;
    let originalContent: string | undefined;
    try {
      originalContent = await fs.readFile(fullPath, "utf-8");
      originalExists = true;
    } catch {
      originalExists = false;
    }

    // Load and render template
    const content = await this.loadTemplate(gen.template, gen.data);

    return {
      path: fullPath,
      mode: gen.mode,
      content,
      guards: gen.guards,
      originalExists,
      originalContent,
    };
  }

  private calculateSortOrder(operations: FileOperation[]): string[] {
    return operations
      .map((op) => op.path)
      .sort((a, b) => {
        const depthA = a.split(path.sep).length;
        const depthB = b.split(path.sep).length;

        if (depthA !== depthB) {
          return depthA - depthB; // Parents before children
        }

        return a.localeCompare(b); // Lexicographic order
      });
  }

  private async checkGuards(filePath: string, guards: string[]): Promise<string[]> {
    const violations: string[] = [];

    try {
      const content = await fs.readFile(filePath, "utf-8");

      for (const guard of guards) {
        if (content.includes(guard)) {
          violations.push(`Guard violation: "${guard}" already exists in ${filePath}`);
        }
      }
    } catch (_error) {
      // File doesn't exist - no guard violations
    }

    return violations;
  }

  private async loadTemplate(templatePath: string, data: Record<string, any>): Promise<string> {
    try {
      let content = await fs.readFile(templatePath, "utf-8");

      // Simple template variable substitution - {{.variable}}
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{\\.${key}\\}\\}`, "g");
        content = content.replace(regex, String(value));
      }

      // Handle conditional blocks - {{if .variable}}...{{end}}
      content = content.replace(
        /\{\{if\s+\.(\w+)\}\}(.*?)\{\{end\}\}/gs,
        (_match, varName, block) => {
          return data[varName] ? block : "";
        },
      );

      return content;
    } catch (error) {
      // If template file doesn't exist, treat template as inline content
      if ((error as any).code === "ENOENT") {
        let content = templatePath;

        // Apply same substitutions to inline template
        for (const [key, value] of Object.entries(data)) {
          const regex = new RegExp(`\\{\\{\\.${key}\\}\\}`, "g");
          content = content.replace(regex, String(value));
        }

        return content;
      }
      throw error;
    }
  }
}

/**
 * Plan executor classes - Strategy pattern for execution modes
 */
class RealExecutionStrategy implements ExecutionStrategy {
  async execute(plan: ExecutionPlan, _options: ExecuteOptions): Promise<void> {
    for (const operation of plan.operations) {
      await this.executeOperation(operation);
    }
  }

  private async executeOperation(operation: FileOperation): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(operation.path);
    await fs.mkdir(dir, { recursive: true });

    let finalContent = operation.content;

    if (operation.mode === "patch" && operation.originalExists && operation.originalContent) {
      finalContent = this.applyPatch(operation.originalContent, operation.content);
    }

    await fs.writeFile(operation.path, finalContent, "utf-8");
  }

  private applyPatch(originalContent: string, patchContent: string): string {
    // Look for ARBITER:BEGIN/END markers in patch
    const markerRegex = /\/\/\s*ARBITER:BEGIN\s+(\w+)(.*?)\/\/\s*ARBITER:END\s+\1/g;

    let result = originalContent;
    let match;

    while ((match = markerRegex.exec(patchContent)) !== null) {
      const [fullMatch, markerId, _blockContent] = match;

      // Check if this block already exists in original
      const existingBlockRegex = new RegExp(
        `//\\s*ARBITER:BEGIN\\s+${markerId}.*?//\\s*ARBITER:END\\s+${markerId}`,
        "g",
      );

      if (existingBlockRegex.test(result)) {
        // Replace existing block
        result = result.replace(existingBlockRegex, fullMatch.trim());
      } else {
        // Append new block
        result = `${result}\n\n${fullMatch.trim()}`;
      }
    }

    return result;
  }
}

class DryRunExecutionStrategy implements ExecutionStrategy {
  async execute(_plan: ExecutionPlan, _options: ExecuteOptions): Promise<void> {
    // No-op for dry run - just validates the plan
  }
}

/**
 * Plan executor class - Single responsibility: Executing plans
 */
class PlanExecutor {
  private strategy: ExecutionStrategy;

  constructor(strategy: ExecutionStrategy) {
    this.strategy = strategy;
  }

  async execute(plan: ExecutionPlan, options: ExecuteOptions): Promise<void> {
    await this.strategy.execute(plan, options);
  }
}

/**
 * Report generator class - Single responsibility: Creating execution reports
 */
class ReportGenerator {
  private workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  generateDiff(operation: FileOperation): string {
    if (!operation.originalExists) {
      // New file
      const lines = operation.content.split("\n");
      return lines.map((line) => chalk.green(`+${line}`)).join("\n");
    }

    if (!operation.originalContent) {
      return chalk.red("Error: Original content not available");
    }

    let finalContent = operation.content;
    if (operation.mode === "patch") {
      finalContent = this.applyPatch(operation.originalContent, operation.content);
    }

    const diff = diffLines(operation.originalContent, finalContent);
    return diff
      .map((part) => {
        const lines = part.value.split("\n").filter((line) => line !== "");
        if (part.added) {
          return lines.map((line) => chalk.green(`+${line}`)).join("\n");
        } else if (part.removed) {
          return lines.map((line) => chalk.red(`-${line}`)).join("\n");
        } else {
          return lines.map((line) => ` ${line}`).join("\n");
        }
      })
      .join("\n");
  }

  createExecutionSummary(
    epic: Epic,
    plan: ExecutionPlan,
    results: ExecutionSummary["results"],
    startTime: number,
  ): ExecutionSummary {
    const duration = Date.now() - startTime;
    return {
      epicId: epic.id,
      timestamp: new Date().toISOString(),
      filesChanged: plan.operations.length,
      testsRun: results.length,
      testsPassed: results.filter((r) => r.passed).length,
      contractsChecked: epic.contracts.types.length + epic.contracts.invariants.length,
      contractsPassed: 0, // Would be implemented with actual CUE evaluation
      rolloutGatesChecked: epic.rollout.gates.length,
      rolloutGatesPassed: 0, // Would be implemented with actual CUE evaluation
      overallSuccess: results.every((r) => r.passed),
      duration,
      results,
    };
  }

  createExecutionReport(plan: ExecutionPlan, duration: number): ExecutionReport {
    return {
      apiVersion: "arbiter.dev/v2",
      timestamp: Date.now(),
      command: "execute",
      kind: "ExecutionReport",
      applied: plan.operations.map((op, index) => ({
        id: `op-${index + 1}`,
        action: op.mode,
        target: path.relative(this.workspace, op.path),
        status: "success" as const,
        duration: 100, // Would track actual duration
      })),
      report: {
        totalActions: plan.operations.length,
        successful: plan.operations.length,
        failed: 0,
        skipped: 0,
        duration,
      },
    };
  }

  createPlanOutput(plan: ExecutionPlan): {
    planOutput: PlanOutput["plan"];
    guards: PlanOutput["guards"];
    diff: any;
  } {
    const planOutput: PlanOutput["plan"] = plan.operations.map((op, index) => ({
      id: `op-${index + 1}`,
      type: "file" as const,
      action: op.mode === "create" ? ("create" as const) : ("update" as const),
      target: path.relative(this.workspace, op.path),
      content: op.content,
      dependencies: [],
      estimatedTime: 100, // milliseconds estimate
    }));

    const guards: PlanOutput["guards"] = plan.guardViolations.map((violation, index) => ({
      id: `guard-${index + 1}`,
      type: "constraint" as const,
      description: violation,
      required: true,
    }));

    const diff = {
      added: plan.operations.filter((op) => !op.originalExists).length,
      modified: plan.operations.filter((op) => op.originalExists).length,
      deleted: 0,
      summary: `${plan.operations.length} operations planned`,
    };

    return { planOutput, guards, diff };
  }

  private applyPatch(originalContent: string, patchContent: string): string {
    // Look for ARBITER:BEGIN/END markers in patch
    const markerRegex = /\/\/\s*ARBITER:BEGIN\s+(\w+)(.*?)\/\/\s*ARBITER:END\s+\1/g;

    let result = originalContent;
    let match;

    while ((match = markerRegex.exec(patchContent)) !== null) {
      const [fullMatch, markerId, _blockContent] = match;

      // Check if this block already exists in original
      const existingBlockRegex = new RegExp(
        `//\\s*ARBITER:BEGIN\\s+${markerId}.*?//\\s*ARBITER:END\\s+${markerId}`,
        "g",
      );

      if (existingBlockRegex.test(result)) {
        // Replace existing block
        result = result.replace(existingBlockRegex, fullMatch.trim());
      } else {
        // Append new block
        result = `${result}\n\n${fullMatch.trim()}`;
      }
    }

    return result;
  }
}

/**
 * Test runner class - Single responsibility: Running and managing tests
 */
class TestRunner {
  private timeout: number;

  constructor(timeout: number = 30000) {
    this.timeout = timeout;
  }

  async runCliTests(tests: Epic["tests"]["cli"]): Promise<ExecutionSummary["results"]> {
    const results: ExecutionSummary["results"] = [];

    for (const test of tests) {
      const result = await this.runSingleCliTest(test);
      results.push({
        name: `CLI: ${test.cmd}`,
        passed: result.passed,
        duration: result.duration,
        error: result.error,
      });
    }

    return results;
  }

  private async runSingleCliTest(test: {
    cmd: string;
    expectExit: number;
    expectRE?: string;
  }): Promise<{ passed: boolean; error?: string; duration: number }> {
    const startTime = Date.now();

    try {
      const { spawn } = await import("node:child_process");
      const [command, ...args] = test.cmd.split(" ");

      return new Promise((resolve) => {
        const proc = spawn(command, args, {
          stdio: ["pipe", "pipe", "pipe"],
          timeout: this.timeout,
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
              passed: false,
              error: `Expected exit code ${test.expectExit}, got ${code}. stderr: ${stderr}`,
              duration,
            });
            return;
          }

          if (test.expectRE && !new RegExp(test.expectRE).test(stdout)) {
            resolve({
              passed: false,
              error: `Output didn't match expected regex: ${test.expectRE}`,
              duration,
            });
            return;
          }

          resolve({ passed: true, duration });
        });

        proc.on("error", (error) => {
          resolve({
            passed: false,
            error: error.message,
            duration: Date.now() - startTime,
          });
        });
      });
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }
}

/**
 * Command classes - Command pattern for execution steps
 */
class LoadEpicCommand implements Command {
  private loader: EpicLoader;
  private epic: Epic | null = null;

  constructor(epicPath: string) {
    this.loader = new EpicLoader(epicPath);
  }

  async execute(): Promise<void> {
    this.epic = await this.loader.load();
  }

  getEpic(): Epic {
    if (!this.epic) {
      throw new Error("Epic not loaded - execute() must be called first");
    }
    return this.epic;
  }
}

class GeneratePlanCommand implements Command {
  private generator: PlanGenerator;
  private plan: ExecutionPlan | null = null;

  constructor(epic: Epic, workspace: string) {
    this.generator = new PlanGenerator(epic, workspace);
  }

  async execute(): Promise<void> {
    this.plan = await this.generator.build();
  }

  getPlan(): ExecutionPlan {
    if (!this.plan) {
      throw new Error("Plan not generated - execute() must be called first");
    }
    return this.plan;
  }
}

class ExecutePlanCommand implements Command {
  private executor: PlanExecutor;
  private plan: ExecutionPlan;
  private options: ExecuteOptions;

  constructor(plan: ExecutionPlan, options: ExecuteOptions) {
    const strategy = options.dryRun ? new DryRunExecutionStrategy() : new RealExecutionStrategy();
    this.executor = new PlanExecutor(strategy);
    this.plan = plan;
    this.options = options;
  }

  async execute(): Promise<void> {
    await this.executor.execute(this.plan, this.options);
  }
}

class RunTestsCommand implements Command {
  private testRunner: TestRunner;
  private epic: Epic;
  private results: ExecutionSummary["results"] = [];

  constructor(epic: Epic, options: ExecuteOptions) {
    this.testRunner = new TestRunner(options.timeout || 30000);
    this.epic = epic;
    this.options = options;
  }

  async execute(): Promise<void> {
    if (this.epic.tests.cli?.length > 0) {
      this.results = await this.testRunner.runCliTests(this.epic.tests.cli);
    }
  }

  getResults(): ExecutionSummary["results"] {
    return this.results;
  }
}

/**
 * Main orchestrator - Coordinates all execution steps using command pattern
 */
export async function executeCommand(options: ExecuteOptions): Promise<number> {
  const startTime = Date.now();
  const workspace = options.workspace || process.cwd();
  const agentMode = shouldUseAgentMode(options);
  const outputManager = createOutputManager("execute", agentMode, options.ndjsonOutput);
  const reportGenerator = new ReportGenerator(workspace);

  // Define execution steps
  const steps = [
    "Loading epic configuration",
    "Analyzing targets and dependencies",
    "Generating execution plan",
    "Validating guards and constraints",
    "Applying file changes",
    "Running tests",
    "Verifying contracts",
    "Generating execution report",
  ];

  return withStepProgress(
    {
      title: `Executing epic: ${path.basename(options.epic)}`,
      steps,
      color: "blue",
    },
    async (progress) => {
      try {
        // Initialize output
        outputManager.emitEvent({
          phase: "plan",
          status: "start",
          data: { actions: 0, guards: 0 },
        });

        if (!agentMode) {
          console.log(chalk.dim(`Workspace: ${workspace}`));
        }

        // Step 1: Load epic
        progress.nextStep("Loading epic configuration");
        const loadEpicCommand = new LoadEpicCommand(options.epic);
        await loadEpicCommand.execute();
        const epic = loadEpicCommand.getEpic();

        if (!agentMode) {
          console.log(chalk.cyan(`📋 Epic: ${epic.title} (${epic.id})`));
          console.log(chalk.dim(`Owners: ${epic.owners.join(", ")}`));
        }

        // Step 2: Analyze targets and dependencies
        progress.nextStep("Analyzing targets and dependencies");

        // Step 3: Generate plan
        progress.nextStep("Generating execution plan");
        const generatePlanCommand = new GeneratePlanCommand(epic, workspace);
        await generatePlanCommand.execute();
        const plan = generatePlanCommand.getPlan();

        // Step 4: Validate guards and constraints
        progress.nextStep("Validating guards and constraints");

        // Validate plan
        const validationError = validatePlan(plan, agentMode, outputManager);
        if (validationError) {
          outputManager.close();
          return validationError;
        }

        // Generate reports and outputs
        const { planOutput, guards, diff } = reportGenerator.createPlanOutput(plan);
        await outputManager.writePlanFile(planOutput, guards, diff);

        outputManager.emitEvent({
          phase: "plan",
          status: "complete",
          data: { actions: plan.operations.length, guards: guards.length },
        });

        if (!agentMode) {
          console.log(chalk.green(`✓ Plan generated: ${plan.operations.length} operations`));
        }

        // Handle dry run
        if (options.dryRun) {
          return await handleDryRun(
            plan,
            options,
            outputManager,
            reportGenerator,
            workspace,
            agentMode,
          );
        }

        // Step 5: Apply file changes
        progress.nextStep("Applying file changes");

        outputManager.emitEvent({
          phase: "execute",
          status: "start",
          data: { total: plan.operations.length },
        });

        if (!agentMode) {
          console.log(chalk.blue("\n🔧 Applying changes..."));
        }

        const executePlanCommand = new ExecutePlanCommand(plan, options);
        await executePlanCommand.execute();

        if (!agentMode) {
          console.log(chalk.green(`✓ Applied ${plan.operations.length} file operations`));
        }

        outputManager.emitEvent({
          phase: "execute",
          status: "complete",
          data: { progress: plan.operations.length, total: plan.operations.length },
        });

        // Step 6: Run tests
        progress.nextStep("Running tests");

        const runTestsCommand = new RunTestsCommand(epic, options);
        if (epic.tests.cli?.length > 0) {
          outputManager.emitEvent({
            phase: "test",
            status: "start",
            data: { tests: epic.tests.cli.length },
          });

          if (!agentMode) {
            console.log(chalk.blue("\n🧪 Running CLI tests..."));
          }

          await runTestsCommand.execute();
          const results = runTestsCommand.getResults();

          // Log test results
          if (!agentMode) {
            for (const result of results) {
              if (result.passed) {
                console.log(chalk.green(`  ✓ ${result.name} (${result.duration}ms)`));
              } else {
                console.log(chalk.red(`  ✗ ${result.name} (${result.duration}ms)`));
                if (result.error) {
                  console.log(chalk.red(`    ${result.error}`));
                }
              }
            }
          }

          outputManager.emitEvent({
            phase: "test",
            status: "complete",
            data: {
              tests: results.length,
              passed: results.filter((r) => r.passed).length,
              failed: results.filter((r) => !r.passed).length,
            },
          });
        }

        // Step 7: Verify contracts
        progress.nextStep("Verifying contracts");

        // Step 8: Generate execution report
        progress.nextStep("Generating execution report");

        // Generate final reports
        const results = runTestsCommand.getResults();
        const duration = Date.now() - startTime;
        const summary = reportGenerator.createExecutionSummary(epic, plan, results, startTime);
        const executionReport = reportGenerator.createExecutionReport(plan, duration);

        // Add JUnit report if needed
        if (options.junit || results.length > 0) {
          executionReport.junit = {
            name: `Epic.${epic.id}`,
            tests: results.length,
            failures: results.filter((r) => !r.passed).length,
            errors: 0,
            time: duration / 1000,
            testcases: results.map((result) => ({
              classname: `Epic.${epic.id}`,
              name: result.name,
              time: (result.duration || 0) / 1000,
              ...(result.passed
                ? {}
                : {
                    failure: {
                      message: result.error || "Test failed",
                      type: "AssertionError",
                      content: result.error || "Test failed",
                    },
                  }),
            })),
          };
        }

        // Write final reports
        await outputManager.writeReportFile(executionReport);

        if (options.junit) {
          await outputManager.writeJUnitFile(executionReport.junit!);
        }

        // Output final summary
        if (!agentMode) {
          console.log(chalk.blue("\n📊 Execution Summary:"));
          console.log(`  Epic: ${summary.epicId}`);
          console.log(`  Files changed: ${summary.filesChanged}`);
          console.log(`  Tests: ${summary.testsPassed}/${summary.testsRun} passed`);
          console.log(`  Duration: ${summary.duration}ms`);
          console.log(
            `  Overall: ${summary.overallSuccess ? chalk.green("SUCCESS") : chalk.red("FAILED")}`,
          );
        }

        outputManager.close();
        return summary.overallSuccess ? 0 : 1;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (!agentMode) {
          console.error(chalk.red("❌ Execution failed:"), errorMessage);
        }

        outputManager.emitEvent({
          phase: "execute",
          status: "complete",
          data: { progress: 0, total: 0 },
        });

        outputManager.close();
        return 2;
      }
    },
  );
}

/**
 * Helper function to validate execution plan
 */
function validatePlan(plan: ExecutionPlan, agentMode: boolean, outputManager: any): number | null {
  // Check for conflicts
  if (plan.conflicts.length > 0) {
    if (!agentMode) {
      console.log(chalk.red("\n❌ Conflicts detected:"));
      plan.conflicts.forEach((conflict) => console.log(chalk.red(`  • ${conflict}`)));
    }
    outputManager.emitEvent({
      phase: "plan",
      status: "error",
      error: `Conflicts detected: ${plan.conflicts.join(", ")}`,
    });
    return 1;
  }

  // Check for guard violations
  if (plan.guardViolations.length > 0) {
    if (!agentMode) {
      console.log(chalk.red("\n❌ Guard violations:"));
      plan.guardViolations.forEach((violation) => console.log(chalk.red(`  • ${violation}`)));
    }
    outputManager.emitEvent({
      phase: "plan",
      status: "error",
      error: `Guard violations: ${plan.guardViolations.join(", ")}`,
    });
    return 1;
  }

  return null;
}

/**
 * Helper function to handle dry run execution
 */
async function handleDryRun(
  plan: ExecutionPlan,
  options: ExecuteOptions,
  outputManager: any,
  reportGenerator: ReportGenerator,
  workspace: string,
  agentMode: boolean,
): Promise<number> {
  if (!agentMode) {
    console.log(chalk.blue("\n📝 Dry run - showing planned changes:\n"));

    for (const operation of plan.operations) {
      const relativePath = path.relative(workspace, operation.path);
      console.log(chalk.bold(`📄 ${relativePath} (${operation.mode})`));

      if (options.verbose) {
        const diffText = reportGenerator.generateDiff(operation);
        console.log(diffText);
        console.log(""); // Empty line separator
      }
    }

    console.log(chalk.blue(`\n📊 Summary:`));
    console.log(`  Files to modify: ${plan.operations.length}`);
    console.log(`  New files: ${plan.operations.filter((op) => !op.originalExists).length}`);
    console.log(`  Existing files: ${plan.operations.filter((op) => op.originalExists).length}`);
  }

  // Generate diff.txt file
  const diffContent = plan.operations.map((op) => reportGenerator.generateDiff(op)).join("\n\n");
  await outputManager.writeDiffFile(diffContent);

  outputManager.close();
  return 0;
}

/**
 * Generate JUnit XML report
 */
function _generateJUnitXML(summary: ExecutionSummary): string {
  const testcases = summary.results
    .map(
      (result) => `
    <testcase 
      classname="Epic.${summary.epicId}" 
      name="${result.name}" 
      time="${(result.duration || 0) / 1000}">
      ${result.passed ? "" : `<failure message="${result.error || "Test failed"}">${result.error || "Test failed"}</failure>`}
    </testcase>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite 
  name="Epic.${summary.epicId}" 
  tests="${summary.testsRun}" 
  failures="${summary.testsRun - summary.testsPassed}" 
  time="${summary.duration / 1000}"
  timestamp="${summary.timestamp}">
  ${testcases}
</testsuite>`;
}
