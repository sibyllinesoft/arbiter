/**
 * CLI Command: Generate Tests
 * 
 * Implements the new IR-based test generation system that replaces
 * the problematic string-based test generation with safe, validated output.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { TestGenerator, type TestGenerationOptions } from '../test-generation/test-generator.js';
import { logger } from '../utils/logger.js';

interface GenerateTestsCommandOptions {
  input?: string;
  output?: string;
  frameworks?: string;
  strict?: boolean;
  dryRun?: boolean;
  ndjson?: boolean;
  harness?: boolean;
  maxScenarios?: number;
  verbose?: boolean;
}

/**
 * Create the tests:generate command
 */
export function createGenerateTestsCommand(): Command {
  return new Command('generate')
    .alias('gen')
    .description('Generate TypeScript tests from CUE schemas using IR-based templates')
    .option('-i, --input <dir>', 'Input directory containing CUE schema files', 'spec')
    .option('-o, --output <dir>', 'Output directory for generated tests', 'tests/generated')
    .option('-f, --frameworks <list>', 'Test frameworks to generate for (bun,playwright,vitest)', 'bun')
    .option('--strict', 'Enable strict validation gates (prettier, tsc, framework)', false)
    .option('--dry-run', 'Show what would be generated without writing files', false)
    .option('--ndjson', 'Generate NDJSON test vectors for runtime validation', true)
    .option('--harness', 'Run NDJSON validation harness (can be slow)', false)
    .option('--max-scenarios <number>', 'Maximum number of scenarios to process', '1000')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(async (options: GenerateTestsCommandOptions) => {
      await executeGenerateTests(options);
    });
}

/**
 * Execute the generate tests command
 */
async function executeGenerateTests(options: GenerateTestsCommandOptions): Promise<void> {
  const spinner = ora('Initializing test generation...').start();

  try {
    // Configure logging
    if (options.verbose) {
      logger.level = 'debug';
    }

    // Parse frameworks
    const frameworks = options.frameworks
      ?.split(',')
      .map(f => f.trim())
      .filter(f => ['bun', 'playwright', 'vitest'].includes(f)) as ('bun' | 'playwright' | 'vitest')[];

    if (!frameworks || frameworks.length === 0) {
      throw new Error('At least one valid framework must be specified (bun, playwright, vitest)');
    }

    // Create generator options
    const generatorOptions: Partial<TestGenerationOptions> = {
      inputDir: options.input || 'spec',
      outputDir: options.output || 'tests/generated',
      strictValidation: options.strict || false,
      generateNDJSON: options.ndjson !== false, // Default true
      runHarness: options.harness || false,
      dryRun: options.dryRun || false,
      maxScenarios: parseInt(options.maxScenarios || '1000', 10),
      frameworks,
    };

    spinner.text = 'Starting test generation pipeline...';
    const generator = new TestGenerator(generatorOptions);

    // Run generation
    let report;
    if (options.dryRun) {
      spinner.text = 'Running dry run...';
      report = await generator.dryRun();
    } else {
      spinner.text = 'Processing CUE schemas...';
      report = await generator.generateAllTests();
    }

    spinner.succeed(chalk.green('Test generation completed successfully'));

    // Display results
    displayGenerationReport(report, options);

    // Exit with appropriate code
    const hasErrors = report.summary.failedArtifacts > 0 || report.errors.length > 0;
    if (hasErrors && options.strict) {
      console.log(chalk.yellow('\n⚠️  Generation completed with validation errors'));
      process.exit(1);
    }

  } catch (error) {
    spinner.fail(chalk.red('Test generation failed'));
    
    if (error instanceof Error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      
      if (options.verbose && error.stack) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(`\nUnknown error: ${String(error)}`));
    }

    process.exit(1);
  }
}

/**
 * Display comprehensive generation report
 */
function displayGenerationReport(
  report: any,
  options: GenerateTestsCommandOptions
): void {
  console.log('\n' + chalk.bold.blue('📊 Test Generation Report'));
  console.log('═'.repeat(50));

  // Summary table
  const summaryData = [
    ['Metric', 'Count', 'Status'],
    ['Input files', report.summary.totalInputFiles.toString(), '📁'],
    ['Total scenarios', report.summary.totalScenarios.toString(), '🧪'],
    ['Successful tests', report.summary.successfulArtifacts.toString(), '✅'],
    ['Failed tests', report.summary.failedArtifacts.toString(), report.summary.failedArtifacts > 0 ? '❌' : '✅'],
    ['Skipped tests', report.summary.skippedArtifacts.toString(), '⏭️'],
    ['Validation errors', report.summary.validationErrors.toString(), report.summary.validationErrors > 0 ? '⚠️' : '✅'],
    ['NDJSON vectors', report.summary.ndjsonVectors.toString(), report.summary.ndjsonVectors > 0 ? '📊' : '➖'],
  ];

  if (report.summary.harnessResults) {
    summaryData.push(
      ['Harness passed', report.summary.harnessResults.passed.toString(), '✅'],
      ['Harness failed', report.summary.harnessResults.failed.toString(), report.summary.harnessResults.failed > 0 ? '❌' : '✅'],
      ['Coverage %', report.summary.harnessResults.coverage.toString() + '%', report.summary.harnessResults.coverage > 80 ? '✅' : '⚠️'],
    );
  }

  console.log(table(summaryData, {
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│',
      joinBody: '─',
      joinLeft: '├',
      joinRight: '┤',
      joinJoin: '┼'
    }
  }));

  // Performance metrics
  console.log('\n' + chalk.bold.cyan('⏱️  Performance Metrics'));
  console.log(`Conversion: ${chalk.yellow(report.performance.conversionTime + 'ms')}`);
  console.log(`Rendering: ${chalk.yellow(report.performance.renderingTime + 'ms')}`);
  console.log(`Validation: ${chalk.yellow(report.performance.validationTime + 'ms')}`);
  console.log(`Total: ${chalk.yellow(report.performance.totalTime + 'ms')}`);

  // File locations
  console.log('\n' + chalk.bold.green('📂 Output Locations'));
  console.log(`Test files: ${chalk.underline(options.output || 'tests/generated')}`);
  
  if (report.files.ndjsonFile) {
    console.log(`NDJSON vectors: ${chalk.underline(report.files.ndjsonFile)}`);
  }

  // Quality gates status
  if (report.artifacts?.length > 0) {
    console.log('\n' + chalk.bold.magenta('🛡️  Validation Gates Status'));
    
    const gateStats = calculateGateStats(report.artifacts);
    
    for (const [gate, stats] of Object.entries(gateStats)) {
      const passRate = Math.round((stats.passed / stats.total) * 100);
      const status = passRate === 100 ? '✅' : passRate > 80 ? '⚠️' : '❌';
      console.log(`${gate}: ${chalk.yellow(passRate + '%')} ${status} (${stats.passed}/${stats.total})`);
    }
  }

  // Error summary
  if (report.errors.length > 0) {
    console.log('\n' + chalk.bold.red('❌ Validation Errors (First 5)'));
    report.errors.slice(0, 5).forEach((error: string, index: number) => {
      console.log(`${index + 1}. ${chalk.gray(error)}`);
    });
    
    if (report.errors.length > 5) {
      console.log(chalk.gray(`... and ${report.errors.length - 5} more errors`));
    }
  }

  // Next steps
  console.log('\n' + chalk.bold.blue('🚀 Next Steps'));
  
  if (options.dryRun) {
    console.log('• Run without --dry-run to generate actual test files');
  } else {
    console.log('• Run generated tests: ' + chalk.cyan(`bun test ${options.output || 'tests/generated'}`));
  }
  
  if (report.summary.ndjsonVectors > 0 && !options.harness) {
    console.log('• Run validation harness: ' + chalk.cyan('arbiter tests generate --harness'));
  }
  
  if (report.summary.validationErrors > 0) {
    console.log('• Fix validation issues and re-run with --strict for production quality');
  }

  console.log();
}

/**
 * Calculate validation gate statistics
 */
function calculateGateStats(artifacts: any[]): Record<string, { passed: number; total: number }> {
  const stats: Record<string, { passed: number; total: number }> = {};

  for (const artifact of artifacts) {
    for (const [gateName, gate] of Object.entries(artifact.validation)) {
      if (!stats[gateName]) {
        stats[gateName] = { passed: 0, total: 0 };
      }
      
      stats[gateName].total++;
      if ((gate as any).status === 'passed') {
        stats[gateName].passed++;
      }
    }
  }

  return stats;
}

/**
 * Validation report command
 */
export function createValidateTestsCommand(): Command {
  return new Command('validate')
    .description('Validate existing generated test files')
    .option('-o, --output <dir>', 'Directory containing generated tests', 'tests/generated')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(async (options: { output?: string; verbose?: boolean }) => {
      const spinner = ora('Validating existing tests...').start();

      try {
        if (options.verbose) {
          logger.level = 'debug';
        }

        const generator = new TestGenerator({
          outputDir: options.output || 'tests/generated',
          strictValidation: true,
        });

        const report = await generator.validateExistingTests();
        
        spinner.succeed(chalk.green('Test validation completed'));
        displayGenerationReport(report, { output: options.output });

      } catch (error) {
        spinner.fail(chalk.red('Test validation failed'));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}

/**
 * NDJSON harness command
 */
export function createHarnessCommand(): Command {
  return new Command('harness')
    .description('Run NDJSON validation harness against test vectors')
    .option('-f, --file <path>', 'NDJSON vectors file', 'tests/generated/vectors/test-vectors.ndjson')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .action(async (options: { file?: string; verbose?: boolean }) => {
      const spinner = ora('Running validation harness...').start();

      try {
        if (options.verbose) {
          logger.level = 'debug';
        }

        const harness = new (await import('../test-generation/ndjson-harness.js')).NDJSONHarness({
          runValidation: true,
        });

        const report = await harness.loadAndRun(options.file);
        
        spinner.succeed(chalk.green('Validation harness completed'));
        
        console.log('\n' + chalk.bold.blue('🧪 NDJSON Harness Results'));
        console.log(`Total vectors: ${chalk.yellow(report.totalVectors)}`);
        console.log(`Passed: ${chalk.green(report.passedVectors)}`);
        console.log(`Failed: ${chalk.red(report.failedVectors)}`);
        console.log(`Coverage: ${chalk.cyan(Math.round((report.passedVectors / report.totalVectors) * 100) + '%')}`);
        console.log(`Duration: ${chalk.gray(report.duration + 'ms')}`);

      } catch (error) {
        spinner.fail(chalk.red('Harness execution failed'));
        console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
}

// Export the main command with subcommands
export function createTestsCommand(): Command {
  const testsCommand = new Command('tests')
    .description('Test generation and validation commands')
    .addCommand(createGenerateTestsCommand())
    .addCommand(createValidateTestsCommand()) 
    .addCommand(createHarnessCommand());

  return testsCommand;
}

export default createTestsCommand;