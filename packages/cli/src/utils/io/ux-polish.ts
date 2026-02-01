#!/usr/bin/env node

import chalk from "chalk";

/**
 * UX Polish utilities for beautiful CLI experience
 */

/**
 * Error pattern matcher definition
 */
interface ErrorPatternMatcher {
  patterns: string[];
  showHelp: (message: string) => void;
}

/**
 * Registered error pattern handlers
 */
const ERROR_PATTERN_MATCHERS: ErrorPatternMatcher[] = [
  { patterns: ["ENOENT", "not found"], showHelp: showFileNotFoundHelp },
  { patterns: ["EACCES", "permission"], showHelp: () => showPermissionHelp() },
  { patterns: ["Connection refused", "ECONNREFUSED"], showHelp: () => showConnectionHelp() },
  { patterns: ["arbiter.assembly.cue"], showHelp: () => showAssemblyHelp() },
  { patterns: ["Invalid", "validation"], showHelp: () => showValidationHelp() },
];

/**
 * Find matching error pattern handler
 */
function findMatchingErrorHandler(message: string): ErrorPatternMatcher | undefined {
  return ERROR_PATTERN_MATCHERS.find((matcher) =>
    matcher.patterns.some((pattern) => message.includes(pattern)),
  );
}

/**
 * Format beautiful error messages with helpful suggestions
 */
export function formatError(error: Error | string, context?: string): void {
  const message = error instanceof Error ? error.message : error;

  console.log();
  console.log(chalk.red.bold("❌ Error"));
  console.log(chalk.red(`   ${message}`));

  if (context) {
    console.log(chalk.gray(`   Context: ${context}`));
  }

  // Add contextual help based on common error patterns
  const handler = findMatchingErrorHandler(message);
  if (handler) {
    handler.showHelp(message);
  }

  console.log();
}

/**
 * Show next-step hints after successful commands
 */
export function showNextSteps(command: string, context?: Record<string, any>): void {
  const steps = getNextSteps(command, context);

  if (steps.length === 0) return;

  console.log();
  console.log(chalk.blue.bold("🎯 Next steps:"));

  for (let i = 0; i < steps.length; i++) {
    console.log(chalk.dim(`   ${i + 1}. ${steps[i]}`));
  }

  console.log();
}

/**
 * Get contextual next steps based on command
 */
function getNextSteps(command: string, context?: Record<string, any>): string[] {
  const steps: string[] = [];

  switch (command) {
    case "init":
      steps.push("Edit arbiter.assembly.cue to customize your project");
      steps.push('Run "arbiter status" to validate configuration');
      steps.push('Use "arbiter list" to understand your setup');
      steps.push('Generate examples with "arbiter examples profile"');
      break;

    case "check":
      if (context?.success) {
        steps.push('Create tests with "arbiter tests scaffold"');
      } else {
        steps.push("Fix validation errors above");
        steps.push('Use "arbiter list" to understand configuration');
        steps.push('Check examples with "arbiter examples profile"');
      }
      break;

    case "surface":
      steps.push('Plan version changes with "arbiter version plan"');
      steps.push('Generate documentation with "arbiter docs schema"');
      steps.push('Set up continuous validation with "arbiter watch"');
      break;

    case "watch":
      steps.push("Keep this running during development");
      steps.push("Open another terminal for other arbiter commands");
      steps.push("Press Ctrl+C to stop watching");
      break;

    case "docs":
      steps.push("Share documentation with your team");
      steps.push("Set up automated regeneration in CI");
      steps.push("Consider serving docs locally or on GitHub Pages");
      break;

    case "examples":
      steps.push("Browse generated examples in the output directory");
      steps.push("Copy useful patterns to your project");
      steps.push('Run "arbiter init" in example directories to try them');
      break;

    case "tests":
      steps.push("Run generated tests to verify they work");
      steps.push("Customize test cases for your specific needs");
      steps.push('Check coverage with "arbiter tests cover"');
      break;

    case "version":
      steps.push("Review version plan carefully");
      steps.push("Update CHANGELOG.md if needed");
      steps.push('Run "arbiter version release --apply" when ready');
      break;

    case "integrate":
      steps.push("Review generated CI/CD workflows");
      steps.push("Customize for your specific needs");
      steps.push("Commit and push to activate workflows");
      break;

    case "sync":
      steps.push("Verify manifest updates are correct");
      steps.push("Test that build tools still work");
      steps.push("Update any custom build scripts if needed");
      break;

    default:
      steps.push('Run "arbiter --help" for more commands');
      steps.push('Use "arbiter list" to understand your project');
  }

  return steps;
}

/**
 * Show contextual help for file not found errors
 */
function showFileNotFoundHelp(message: string): void {
  console.log();
  console.log(chalk.yellow.bold("💡 Common solutions:"));

  if (message.includes("arbiter.assembly.cue")) {
    console.log(chalk.dim('   • Run "arbiter init --preset <id>" to create assembly file'));
    console.log(chalk.dim("   • Check you're in the right directory"));
    console.log(chalk.dim('   • Use "arbiter examples profile" to see working examples'));
  } else if (message.includes(".cue")) {
    console.log(chalk.dim("   • Check the file path is correct"));
    console.log(chalk.dim("   • Ensure CUE files have proper syntax"));
    console.log(chalk.dim('   • Use "arbiter status" to validate all CUE files'));
  } else {
    console.log(chalk.dim("   • Check the file or directory path"));
    console.log(chalk.dim("   • Ensure you have the right permissions"));
    console.log(chalk.dim("   • Make sure you're in the correct directory"));
  }
}

/**
 * Show help for permission errors
 */
function showPermissionHelp(): void {
  console.log();
  console.log(chalk.yellow.bold("💡 Permission solutions:"));
  console.log(chalk.dim("   • Check file and directory permissions"));
  console.log(chalk.dim("   • Ensure you have write access to the target directory"));
  console.log(chalk.dim("   • Try running with appropriate user permissions"));
  console.log(chalk.dim("   • Use --output to specify a different directory"));
}

/**
 * Show help for connection errors
 */
function showConnectionHelp(): void {
  console.log();
  console.log(chalk.yellow.bold("💡 Connection solutions:"));
  console.log(
    chalk.dim("   • Start the Arbiter dev stack via 'bun run dev:full' (see the root README)."),
  );
  console.log(chalk.dim("   • If you use Docker, run 'docker compose up api' per docs/deploy."));
  console.log(chalk.dim("   • Ensure --api-url or config.apiUrl matches the server you started."));
  console.log(chalk.dim("   • Run 'arbiter auth login' to authenticate with the server."));
}

/**
 * Show help for assembly file issues
 */
function showAssemblyHelp(): void {
  console.log();
  console.log(chalk.yellow.bold("💡 Assembly configuration help:"));
  console.log(chalk.dim("   • Create assembly: arbiter init --preset <id>"));
  console.log(chalk.dim("   • Understand config: arbiter list"));
  console.log(chalk.dim("   • See examples: arbiter examples profile"));
  console.log(chalk.dim("   • Generate docs: arbiter docs schema"));
}

/**
 * Show help for validation errors
 */
function showValidationHelp(): void {
  console.log();
  console.log(chalk.yellow.bold("💡 Validation help:"));
  console.log(chalk.dim('   • Check CUE syntax with "cue fmt"'));
  console.log(chalk.dim('   • Use "arbiter status --verbose" for details'));
  console.log(chalk.dim('   • Compare with "arbiter examples profile"'));
  console.log(chalk.dim('   • Get explanation: "arbiter list"'));
}

/**
 * Show progress indicator for long operations
 */
export class ProgressIndicator {
  private interval?: NodeJS.Timeout;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private current = 0;
  private message = "";

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    process.stdout.write(`${chalk.blue(this.frames[0])} ${this.message}`);

    this.interval = setInterval(() => {
      this.current = (this.current + 1) % this.frames.length;
      process.stdout.write(`\r${chalk.blue(this.frames[this.current])} ${this.message}`);
    }, 80);
  }

  update(message: string): void {
    this.message = message;
    if (this.interval) {
      process.stdout.write(`\r${chalk.blue(this.frames[this.current])} ${this.message}`);
    }
  }

  succeed(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    console.log(`${chalk.green("✅")} ${finalMessage}`);
  }

  fail(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    console.log(`${chalk.red("❌")} ${finalMessage}`);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
      process.stdout.write("\r");
    }
  }
}

/**
 * Format success messages with consistent styling
 */
export function showSuccess(message: string, details?: string[]): void {
  console.log();
  console.log(chalk.green.bold("✅ Success"));
  console.log(chalk.green(`   ${message}`));

  if (details && details.length > 0) {
    console.log();
    for (const detail of details) {
      console.log(chalk.dim(`   • ${detail}`));
    }
  }

  console.log();
}

/**
 * Format warning messages
 */
export function showWarning(message: string, suggestions?: string[]): void {
  console.log();
  console.log(chalk.yellow.bold("⚠️  Warning"));
  console.log(chalk.yellow(`   ${message}`));

  if (suggestions && suggestions.length > 0) {
    console.log();
    console.log(chalk.yellow.bold("💡 Suggestions:"));
    for (const suggestion of suggestions) {
      console.log(chalk.dim(`   • ${suggestion}`));
    }
  }

  console.log();
}

/**
 * Format info messages with consistent styling
 */
export function showInfo(message: string, items?: string[]): void {
  console.log();
  console.log(chalk.blue.bold("ℹ️  Information"));
  console.log(chalk.blue(`   ${message}`));

  if (items && items.length > 0) {
    console.log();
    for (const item of items) {
      console.log(chalk.dim(`   • ${item}`));
    }
  }

  console.log();
}

/**
 * Create a beautiful banner for major operations
 */
export function showBanner(title: string, subtitle?: string): void {
  const width = Math.max(title.length, subtitle?.length || 0) + 4;
  const border = "═".repeat(width);

  console.log();
  console.log(chalk.cyan(`╔${border}╗`));
  console.log(
    chalk.cyan("║") +
      chalk.bold.white(title.padStart((width + title.length) / 2).padEnd(width)) +
      chalk.cyan("║"),
  );

  if (subtitle) {
    console.log(
      chalk.cyan("║") +
        chalk.gray(subtitle.padStart((width + subtitle.length) / 2).padEnd(width)) +
        chalk.cyan("║"),
    );
  }

  console.log(chalk.cyan(`╚${border}╝`));
  console.log();
}

/**
 * Show helpful hints for discovery
 */
export function showHints(): void {
  const hints = [
    'Use "arbiter list" to understand your project configuration',
    'Run "arbiter examples profile" to see working project templates',
    'Try "arbiter watch" for continuous validation during development',
    'Generate documentation with "arbiter docs schema --examples"',
    'Use "arbiter --help" to see all available commands',
  ];

  const randomHint = hints[Math.floor(Math.random() * hints.length)];

  console.log();
  console.log(chalk.magenta.bold("💡 Hint:"));
  console.log(chalk.dim(`   ${randomHint}`));
  console.log();
}

/**
 * Handle successful operation with optional hints
 */
function handleOperationSuccess<T>(
  result: T,
  progress: ProgressIndicator,
  options: { successMessage?: string; startMessage: string; command?: string; showHints?: boolean },
): T {
  progress.succeed(options.successMessage || options.startMessage);

  if (options.command) {
    showNextSteps(options.command);
  }

  if (options.showHints && Math.random() < 0.3) {
    showHints();
  }

  return result;
}

/**
 * Command execution wrapper with consistent UX
 */
export async function executeWithUX<T>(
  operation: () => Promise<T>,
  {
    startMessage,
    successMessage,
    errorContext,
    command,
    showHints: hints = true,
  }: {
    startMessage: string;
    successMessage?: string;
    errorContext?: string;
    command?: string;
    showHints?: boolean;
  },
): Promise<T> {
  const progress = new ProgressIndicator(startMessage);
  progress.start();

  try {
    const result = await operation();
    return handleOperationSuccess(result, progress, {
      successMessage,
      startMessage,
      command,
      showHints: hints,
    });
  } catch (error) {
    progress.fail(`Failed: ${startMessage}`);
    formatError(error instanceof Error ? error : new Error(String(error)), errorContext);
    throw error;
  }
}
