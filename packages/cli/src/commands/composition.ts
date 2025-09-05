import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import type {
  CompositionOptions,
  ImportSrfOptions,
  ValidateCompositionOptions,
  RecoveryOptions,
} from "../types.js";
import { ProjectCompositionManager } from "../composition/index.js";
import { withProgress } from "../utils/progress.js";

/**
 * Initialize project composition system in current directory
 */
export async function compositionInitCommand(options: CompositionOptions = {}): Promise<number> {
  try {
    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    // Check if already initialized
    const arbiterDir = path.join(cwd, ".arbiter");
    const configPath = path.join(arbiterDir, "project.json");
    
    if (await fs.pathExists(configPath)) {
      console.log(chalk.yellow("Project composition system already initialized"));
      return 0;
    }

    // Get project details
    const projectDetails = await getProjectDetails(options);

    return await withProgress(
      { text: "Initializing project composition system...", color: "blue" },
      async () => {
        await manager.initialize(projectDetails);

        console.log(chalk.green("✓ Project composition system initialized"));
        console.log(chalk.dim("\nNext steps:"));
        console.log(chalk.dim("  arbiter composition validate    # Validate setup"));
        console.log(chalk.dim("  arbiter composition import <srf> # Import fragments"));
        console.log(chalk.dim("  arbiter composition generate    # Generate composed spec"));

        return 0;
      }
    );

  } catch (error) {
    console.error(
      chalk.red("Composition initialization failed:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Import an SRF fragment into the project
 */
export async function compositionImportCommand(
  fragmentPath: string | undefined,
  options: ImportSrfOptions
): Promise<number> {
  try {
    if (!fragmentPath) {
      console.error(chalk.red("Fragment path is required"));
      console.log(chalk.dim("Usage: arbiter composition import <fragment-path>"));
      return 1;
    }

    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    // Ensure fragment file exists
    if (!await fs.pathExists(fragmentPath)) {
      console.error(chalk.red(`Fragment file not found: ${fragmentPath}`));
      return 1;
    }

    const importOptions: ImportSrfOptions = {
      ...options,
      fragment: fragmentPath,
    };

    if (options.verbose) {
      console.log(chalk.dim(`Importing fragment: ${fragmentPath}`));
    }

    const result = await manager.importFragment(importOptions);

    if (result.success) {
      console.log(chalk.green(`✓ Successfully imported fragment: ${result.fragmentId}`));
      
      if (result.conflicts && result.conflicts.length > 0) {
        console.log(chalk.yellow(`⚠ ${result.conflicts.length} conflicts detected but resolved`));
        
        if (options.verbose) {
          for (const conflict of result.conflicts) {
            console.log(chalk.dim(`  - ${conflict.type}: ${conflict.description}`));
          }
        }
      }

      console.log(chalk.dim("\nNext steps:"));
      console.log(chalk.dim("  arbiter composition validate    # Validate composition"));
      console.log(chalk.dim("  arbiter composition generate    # Update composed spec"));

    } else {
      console.error(chalk.red(`✗ Failed to import fragment: ${result.error}`));
      
      if (result.conflicts && result.conflicts.length > 0) {
        console.log(chalk.yellow(`\n${result.conflicts.length} conflicts detected:`));
        
        for (const conflict of result.conflicts) {
          console.log(chalk.yellow(`  • ${conflict.type}: ${conflict.description}`));
          console.log(chalk.dim(`    Path: ${conflict.cuePath}`));
          console.log(chalk.dim(`    Severity: ${conflict.severity}`));
        }

        console.log(chalk.dim("\nTo resolve conflicts:"));
        console.log(chalk.dim("  arbiter composition resolve     # Interactive conflict resolution"));
        console.log(chalk.dim("  arbiter composition import --force <fragment>  # Force import"));
      }

      return 1;
    }

    return 0;

  } catch (error) {
    console.error(
      chalk.red("Fragment import failed:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Validate current project composition
 */
export async function compositionValidateCommand(
  options: ValidateCompositionOptions = {}
): Promise<number> {
  try {
    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    const result = await manager.validateComposition(options);

    // Display results in table format
    if (options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else if (options.format === "yaml") {
      // Would implement YAML output here
      console.log("YAML output not yet implemented");
    } else {
      // Table format (default)
      console.log(chalk.cyan("Project Composition Validation Results"));
      console.log("═".repeat(50));

      if (result.success) {
        console.log(chalk.green("✓ Overall Status: VALID"));
      } else {
        console.log(chalk.red("✗ Overall Status: INVALID"));
      }

      // Fragment status
      console.log(chalk.cyan("\nFragment Status:"));
      const fragmentEntries = Object.entries(result.fragmentsStatus);
      
      if (fragmentEntries.length === 0) {
        console.log(chalk.dim("  No fragments imported"));
      } else {
        for (const [fragmentId, status] of fragmentEntries) {
          const statusColor = status === "valid" ? chalk.green : 
                             status === "invalid" ? chalk.red : chalk.yellow;
          console.log(`  ${statusColor(status.padEnd(8))} ${fragmentId}`);
        }
      }

      // Conflicts
      if (result.conflicts.length > 0) {
        console.log(chalk.yellow(`\nConflicts (${result.conflicts.length}):`));
        for (const conflict of result.conflicts) {
          console.log(chalk.yellow(`  • ${conflict.type}: ${conflict.description}`));
          console.log(chalk.dim(`    Path: ${conflict.cuePath} | Severity: ${conflict.severity}`));
        }
      } else {
        console.log(chalk.green("\nNo conflicts detected"));
      }

      // Errors
      if (result.errors.length > 0) {
        console.log(chalk.red(`\nErrors (${result.errors.length}):`));
        for (const error of result.errors) {
          console.log(chalk.red(`  • ${error}`));
        }
      }

      // Warnings
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\nWarnings (${result.warnings.length}):`));
        for (const warning of result.warnings) {
          console.log(chalk.yellow(`  • ${warning}`));
        }
      }
    }

    // Export results if requested
    if (options.exportResults) {
      await fs.writeJson(options.exportResults, result, { spaces: 2 });
      console.log(chalk.dim(`\nValidation results exported to: ${options.exportResults}`));
    }

    return result.success ? 0 : 1;

  } catch (error) {
    console.error(
      chalk.red("Composition validation failed:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Generate composed specification
 */
export async function compositionGenerateCommand(options: CompositionOptions = {}): Promise<number> {
  try {
    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    return await withProgress(
      { text: "Generating composed specification...", color: "blue" },
      async () => {
        const composedSpec = await manager.generateComposedSpec();

        console.log(chalk.green("✓ Composed specification generated"));
        console.log(chalk.dim(`  Version: ${composedSpec.metadata.version}`));
        console.log(chalk.dim(`  Source fragments: ${composedSpec.metadata.sourceFragments.length}`));
        console.log(chalk.dim(`  Validation status: ${composedSpec.validation.valid ? "VALID" : "INVALID"}`));

        if (!composedSpec.validation.valid) {
          console.log(chalk.yellow(`  Errors: ${composedSpec.validation.errors.length}`));
          console.log(chalk.yellow(`  Warnings: ${composedSpec.validation.warnings.length}`));
        }

        if (options.verbose) {
          const specPath = path.join(cwd, ".arbiter", "composed", "composed-spec.json");
          console.log(chalk.dim(`  Saved to: ${specPath}`));
        }

        return 0;
      }
    );

  } catch (error) {
    console.error(
      chalk.red("Composed specification generation failed:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Recover project from composed specification
 */
export async function compositionRecoverCommand(
  targetDir: string | undefined,
  options: RecoveryOptions
): Promise<number> {
  try {
    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    const recoveryOptions: RecoveryOptions = {
      ...options,
      target: targetDir,
    };

    // Validate recovery capability first
    if (!options.force) {
      const validation = await manager.recoverFromComposedSpec({ ...recoveryOptions, dryRun: true });
      if (!validation.success) {
        console.error(chalk.red(`Recovery validation failed: ${validation.error}`));
        console.log(chalk.dim("\nUse --force to attempt recovery anyway"));
        return 1;
      }
    }

    return await withProgress(
      { text: `Recovering project to ${targetDir || "current directory"}...`, color: "blue" },
      async () => {
        const result = await manager.recoverFromComposedSpec(recoveryOptions);

        if (result.success) {
          console.log(chalk.green("✓ Project recovery completed"));
          console.log(chalk.dim(`  Files recovered: ${result.recoveredFiles.length}`));
          
          if (options.verbose) {
            console.log(chalk.dim("\nRecovered files:"));
            for (const file of result.recoveredFiles) {
              console.log(chalk.dim(`  - ${file}`));
            }
          }

          console.log(chalk.dim("\nNext steps:"));
          console.log(chalk.dim("  cd " + (targetDir || ".")));
          console.log(chalk.dim("  arbiter check"));

        } else {
          console.error(chalk.red(`✗ Recovery failed: ${result.error}`));
          return 1;
        }

        return 0;
      }
    );

  } catch (error) {
    console.error(
      chalk.red("Project recovery failed:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * List project fragments and status
 */
export async function compositionListCommand(options: CompositionOptions = {}): Promise<number> {
  try {
    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    const config = await manager.loadConfig();
    
    if (options.format === "json") {
      console.log(JSON.stringify(config.fragments, null, 2));
    } else {
      console.log(chalk.cyan("Project Fragments"));
      console.log("═".repeat(50));

      if (config.fragments.length === 0) {
        console.log(chalk.dim("No fragments imported"));
        console.log(chalk.dim("\nTo import fragments:"));
        console.log(chalk.dim("  arbiter composition import <srf-file>"));
        return 0;
      }

      for (const fragment of config.fragments) {
        const statusColor = fragment.status === "integrated" ? chalk.green :
                           fragment.status === "conflict" ? chalk.red :
                           fragment.status === "pending" ? chalk.yellow : chalk.gray;

        console.log(`${statusColor(fragment.status.padEnd(12))} ${fragment.filename}`);
        console.log(chalk.dim(`  ID: ${fragment.id}`));
        console.log(chalk.dim(`  Description: ${fragment.description}`));
        console.log(chalk.dim(`  Imported: ${fragment.imported_at}`));
        
        if (fragment.conflicts.length > 0) {
          console.log(chalk.yellow(`  Conflicts: ${fragment.conflicts.length}`));
        }
        
        if (fragment.dependencies.length > 0) {
          console.log(chalk.dim(`  Dependencies: ${fragment.dependencies.join(", ")}`));
        }

        console.log();
      }

      // Summary
      const statusCounts = config.fragments.reduce((counts, fragment) => {
        counts[fragment.status] = (counts[fragment.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      console.log(chalk.cyan("Summary:"));
      for (const [status, count] of Object.entries(statusCounts)) {
        const statusColor = status === "integrated" ? chalk.green :
                           status === "conflict" ? chalk.red :
                           status === "pending" ? chalk.yellow : chalk.gray;
        console.log(`  ${statusColor(status)}: ${count}`);
      }
    }

    return 0;

  } catch (error) {
    console.error(
      chalk.red("Failed to list fragments:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Show project composition status
 */
export async function compositionStatusCommand(options: CompositionOptions = {}): Promise<number> {
  try {
    const cwd = process.cwd();
    const manager = new ProjectCompositionManager(cwd);

    const config = await manager.loadConfig();
    const validation = await manager.validateComposition({ fragments: undefined });

    console.log(chalk.cyan("Project Composition Status"));
    console.log("═".repeat(50));

    // Project metadata
    console.log(chalk.blue("Project:"));
    console.log(`  Name: ${config.metadata.name}`);
    console.log(`  Version: ${config.metadata.version}`);
    console.log(`  Created: ${config.metadata.created_at}`);
    console.log(`  Modified: ${config.metadata.last_modified}`);

    // Configuration
    console.log(chalk.blue("\nConfiguration:"));
    console.log(`  Validation level: ${config.composition.validationLevel}`);
    console.log(`  Auto-resolve conflicts: ${config.composition.autoResolveConflicts}`);
    console.log(`  Master spec: ${config.composition.masterSpecFile}`);

    // Fragments
    console.log(chalk.blue(`\nFragments (${config.fragments.length}):`));
    const statusCounts = config.fragments.reduce((counts, fragment) => {
      counts[fragment.status] = (counts[fragment.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    for (const [status, count] of Object.entries(statusCounts)) {
      const statusColor = status === "integrated" ? chalk.green :
                         status === "conflict" ? chalk.red :
                         status === "pending" ? chalk.yellow : chalk.gray;
      console.log(`  ${statusColor(status)}: ${count}`);
    }

    // Validation status
    console.log(chalk.blue("\nValidation:"));
    if (validation.success) {
      console.log(chalk.green("  Status: VALID"));
    } else {
      console.log(chalk.red("  Status: INVALID"));
      console.log(chalk.red(`  Errors: ${validation.errors.length}`));
      console.log(chalk.yellow(`  Warnings: ${validation.warnings.length}`));
    }

    // Integration history
    console.log(chalk.blue(`\nIntegration History (${config.integrationHistory.length}):`));
    if (config.integrationHistory.length > 0) {
      const recentEntries = config.integrationHistory.slice(-3);
      for (const entry of recentEntries) {
        const statusColor = entry.success ? chalk.green : chalk.red;
        console.log(`  ${statusColor(entry.operation)} - ${entry.timestamp.split("T")[0]} (${entry.fragments.length} fragments)`);
      }
      
      if (config.integrationHistory.length > 3) {
        console.log(chalk.dim(`  ... and ${config.integrationHistory.length - 3} more entries`));
      }
    } else {
      console.log(chalk.dim("  No integration history"));
    }

    return 0;

  } catch (error) {
    console.error(
      chalk.red("Failed to get composition status:"),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

// Helper functions

async function getProjectDetails(options: CompositionOptions): Promise<{
  name: string;
  description: string;
  compositionTemplate: "basic" | "advanced" | "enterprise";
  enableFragments: boolean;
}> {
  const questions: any[] = [];

  // Try to infer from existing files
  const packageJsonPath = path.join(process.cwd(), "package.json");
  const cueModPath = path.join(process.cwd(), "cue.mod", "module.cue");
  
  let defaultName = path.basename(process.cwd());
  let defaultDescription = "CUE project with composition system";

  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      defaultName = packageJson.name || defaultName;
      defaultDescription = packageJson.description || defaultDescription;
    } catch {
      // Continue with defaults
    }
  }

  questions.push({
    type: "input",
    name: "name",
    message: "Project name:",
    default: defaultName,
    validate: (input: string) => {
      if (!input.trim()) return "Project name is required";
      return true;
    },
  });

  questions.push({
    type: "input", 
    name: "description",
    message: "Project description:",
    default: defaultDescription,
  });

  questions.push({
    type: "list",
    name: "compositionTemplate",
    message: "Choose composition template:",
    choices: [
      { name: "Basic - Simple fragment management with auto-conflict resolution", value: "basic" },
      { name: "Advanced - Manual conflict resolution with detailed validation", value: "advanced" },
      { name: "Enterprise - Strict validation with comprehensive recovery", value: "enterprise" }
    ],
    default: "basic",
  });

  const answers = await inquirer.prompt(questions);

  return {
    name: answers.name,
    description: answers.description,
    compositionTemplate: answers.compositionTemplate,
    enableFragments: true,
  };
}