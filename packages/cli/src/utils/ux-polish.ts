#!/usr/bin/env node

import chalk from "chalk";

/**
 * UX Polish utilities for beautiful CLI experience
 */

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
  if (message.includes("ENOENT") || message.includes("not found")) {
    showFileNotFoundHelp(message);
  } else if (message.includes("EACCES") || message.includes("permission")) {
    showPermissionHelp();
  } else if (message.includes("Connection refused") || message.includes("ECONNREFUSED")) {
    showConnectionHelp();
  } else if (message.includes("arbiter.assembly.cue")) {
    showAssemblyHelp();
  } else if (message.includes("Invalid") || message.includes("validation")) {
    showValidationHelp();
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
      steps.push('Run "arbiter check" to validate configuration');
      steps.push('Use "arbiter explain" to understand your setup');
      steps.push('Generate examples with "arbiter examples profile"');
      break;

    case "check":
      if (context?.success) {
        steps.push('Generate API surface with "arbiter surface <language>"');
        steps.push('Set up development workflow with "arbiter watch"');
        steps.push('Create tests with "arbiter tests scaffold"');
      } else {
        steps.push("Fix validation errors above");
        steps.push('Use "arbiter explain" to understand configuration');
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

    case "explain":
      steps.push("Follow the recommendations above");
      steps.push("Address any potential issues listed");
      steps.push('Use "arbiter docs schema" for detailed documentation');
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
      steps.push('Use "arbiter explain" to understand your project');
      steps.push('Check "arbiter health" if having issues');
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
    console.log(chalk.dim('   • Run "arbiter init --template <type>" to create assembly file'));
    console.log(chalk.dim("   • Check you're in the right directory"));
    console.log(chalk.dim('   • Use "arbiter examples profile" to see working examples'));
  } else if (message.includes(".cue")) {
    console.log(chalk.dim("   • Check the file path is correct"));
    console.log(chalk.dim("   • Ensure CUE files have proper syntax"));
    console.log(chalk.dim('   • Use "arbiter check" to validate all CUE files'));
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
  console.log(chalk.dim("   • Start the Arbiter server: bun run dev"));
  console.log(chalk.dim("   • Check server is running on correct port"));
  console.log(chalk.dim("   • Verify API URL in configuration"));
  console.log(chalk.dim("   • Test connection: arbiter health"));
}

/**
 * Show help for assembly file issues
 */
function showAssemblyHelp(): void {
  console.log();
  console.log(chalk.yellow.bold("💡 Assembly configuration help:"));
  console.log(chalk.dim("   • Create assembly: arbiter init --template <type>"));
  console.log(chalk.dim("   • Understand config: arbiter explain"));
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
  console.log(chalk.dim('   • Use "arbiter check --verbose" for details'));
  console.log(chalk.dim('   • Compare with "arbiter examples profile"'));
  console.log(chalk.dim('   • Get explanation: "arbiter explain"'));
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
    'Use "arbiter explain" to understand your project configuration',
    'Run "arbiter examples profile" to see working project templates',
    'Try "arbiter watch" for continuous validation during development',
    'Generate documentation with "arbiter docs schema --examples"',
    'Check server health with "arbiter health" if having issues',
    'Use "arbiter --help" to see all available commands',
  ];

  const randomHint = hints[Math.floor(Math.random() * hints.length)];

  console.log();
  console.log(chalk.magenta.bold("💡 Hint:"));
  console.log(chalk.dim(`   ${randomHint}`));
  console.log();
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

    progress.succeed(successMessage || startMessage);

    if (command) {
      showNextSteps(command);
    }

    if (hints && Math.random() < 0.3) {
      // 30% chance to show a hint
      showHints();
    }

    return result;
  } catch (error) {
    progress.fail(`Failed: ${startMessage}`);
    formatError(error instanceof Error ? error : new Error(String(error)), errorContext);
    throw error;
  }
}
