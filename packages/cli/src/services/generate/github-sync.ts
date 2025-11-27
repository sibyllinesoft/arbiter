/* istanbul ignore file */
import chalk from "chalk";
import type { CLIConfig } from "../../types.js";
import { getSmartRepositoryConfig, validateRepositoryConfig } from "../../utils/git-detection.js";
import { GitHubSyncClient } from "../../utils/github-sync.js";
import { ShardedCUEStorage } from "../../utils/sharded-storage.js";
import type { GenerateOptions } from "./types.js";

/**
 * Handle GitHub synchronization for epics and tasks.
 * This performs network calls and depends on repository state, so we exclude it
 * from strict coverage and exercise only its guards in isolated unit tests.
 */
export async function handleGitHubSync(options: GenerateOptions, config: CLIConfig): Promise<void> {
  if (options.verbose) {
    console.log(chalk.dim("🔄 Starting GitHub sync handler..."));
  }

  try {
    const smartRepoConfig = getSmartRepositoryConfig(config.github?.repository, {
      verbose: options.verbose,
    });

    if (!smartRepoConfig) {
      console.error(chalk.red("❌ No GitHub repository configuration found"));
      console.log(chalk.dim("Options to fix this:"));
      console.log(
        chalk.dim(
          "  1. Initialize Git and add GitHub remote: git remote add origin https://github.com/owner/repo.git",
        ),
      );
      console.log(chalk.dim("  2. Or add GitHub configuration to your .arbiter/config.json:"));
      console.log(
        chalk.dim(`{
  "github": {
    "repository": {
      "owner": "your-org",
      "repo": "your-repo"
    },
    "prefixes": {
      "epic": "[Epic]",
      "task": "[Task]"
    },
    "labels": {
      "default": ["arbiter-generated"]
    },
    "automation": {
      "createMilestones": true,
      "autoClose": true,
      "syncAcceptanceCriteria": true,
      "syncAssignees": false
    }
  }
}`),
      );
      console.log(chalk.dim("\\nAnd set your GitHub token as an environment variable:"));
      console.log(chalk.dim("  export GITHUB_TOKEN=your_github_personal_access_token"));
      return;
    }

    const finalRepo = smartRepoConfig.repo;

    const validation = validateRepositoryConfig(finalRepo);
    if (!validation.valid) {
      console.error(chalk.red("❌ Invalid repository configuration:"));
      validation.errors.forEach((error) => {
        console.log(chalk.red(`  • ${error}`));
      });
      if (validation.suggestions.length > 0) {
        console.log(chalk.dim("\\nSuggestions:"));
        validation.suggestions.forEach((suggestion) => {
          console.log(chalk.dim(`  • ${suggestion}`));
        });
      }
      return;
    }

    if (!finalRepo.owner || !finalRepo.repo) {
      console.error(chalk.red("❌ Repository owner and name are required"));
      console.log(
        chalk.dim(
          "Either configure them in .arbiter/config.json or ensure your Git remote is set correctly",
        ),
      );
      return;
    }

    const githubConfig = {
      repository: finalRepo,
      prefixes: config.github?.prefixes || {
        epic: "[Epic]",
        task: "[Task]",
      },
      labels: config.github?.labels || {
        default: ["arbiter-generated"],
      },
      automation: config.github?.automation || {
        createMilestones: true,
        autoClose: true,
        syncAcceptanceCriteria: true,
        syncAssignees: false,
      },
      templates: config.github?.templates,
    };

    if (options.verbose || smartRepoConfig.source !== "config") {
      const sourceInfo =
        smartRepoConfig.source === "detected"
          ? "auto-detected from Git remote"
          : smartRepoConfig.source === "merged"
            ? "merged from config and Git remote"
            : "from configuration";

      console.log(chalk.dim(`📁 Repository: ${finalRepo.owner}/${finalRepo.repo} (${sourceInfo})`));
    }

    console.log(chalk.blue("📋 Loading epics and tasks..."));
    const storage = new ShardedCUEStorage();
    await storage.initialize();
    const epics = await storage.listEpics();

    if (epics.length === 0) {
      console.log(chalk.yellow("⚠️  No epics found to sync"));
      console.log(chalk.dim("Create epics with: arbiter epic create <name>"));
      return;
    }

    console.log(
      chalk.dim(
        `Found ${epics.length} epics with ${epics.reduce((sum, epic) => sum + epic.tasks.length, 0)} total tasks`,
      ),
    );

    const githubClient = new GitHubSyncClient(githubConfig);
    const isDryRun = options.githubDryRun || options.dryRun;

    if (isDryRun) {
      console.log(chalk.blue("🔍 GitHub Sync Preview (dry run)"));

      const preview = await githubClient.generateSyncPreview(epics);

      console.log(chalk.green("\\n📊 Sync Preview:"));

      if (preview.epics.create.length > 0) {
        console.log(chalk.cyan(`\\n  📝 Epics to create: ${preview.epics.create.length}`));
        preview.epics.create.forEach((epic) => {
          console.log(chalk.dim(`    • ${epic.name}`));
        });
      }

      if (preview.epics.update.length > 0) {
        console.log(chalk.yellow(`\\n  📝 Epics to update: ${preview.epics.update.length}`));
        preview.epics.update.forEach(({ epic }) => {
          console.log(chalk.dim(`    • ${epic.name}`));
        });
      }

      if (preview.epics.close.length > 0) {
        console.log(chalk.red(`\\n  📝 Epics to close: ${preview.epics.close.length}`));
        preview.epics.close.forEach(({ epic }) => {
          console.log(chalk.dim(`    • ${epic.name} (${epic.status})`));
        });
      }

      if (preview.tasks.create.length > 0) {
        console.log(chalk.cyan(`\\n  🔧 Tasks to create: ${preview.tasks.create.length}`));
        preview.tasks.create.forEach((task) => {
          console.log(chalk.dim(`    • ${task.name} (${task.type})`));
        });
      }

      if (preview.tasks.update.length > 0) {
        console.log(chalk.yellow(`\\n  🔧 Tasks to update: ${preview.tasks.update.length}`));
        preview.tasks.update.forEach(({ task }) => {
          console.log(chalk.dim(`    • ${task.name} (${task.type})`));
        });
      }

      if (preview.tasks.close.length > 0) {
        console.log(chalk.red(`\\n  🔧 Tasks to close: ${preview.tasks.close.length}`));
        preview.tasks.close.forEach(({ task }) => {
          console.log(chalk.dim(`    • ${task.name} (${task.status})`));
        });
      }

      if (preview.milestones.create.length > 0) {
        console.log(
          chalk.cyan(`\\n  🎯 Milestones to create: ${preview.milestones.create.length}`),
        );
        preview.milestones.create.forEach((epic) => {
          console.log(chalk.dim(`    • Epic: ${epic.name}`));
        });
      }

      if (preview.milestones.update.length > 0) {
        console.log(
          chalk.yellow(`\\n  🎯 Milestones to update: ${preview.milestones.update.length}`),
        );
        preview.milestones.update.forEach(({ epic }) => {
          console.log(chalk.dim(`    • Epic: ${epic.name}`));
        });
      }

      if (preview.milestones.close.length > 0) {
        console.log(chalk.red(`\\n  🎯 Milestones to close: ${preview.milestones.close.length}`));
        preview.milestones.close.forEach(({ epic }) => {
          console.log(chalk.dim(`    • Epic: ${epic.name} (${epic.status})`));
        });
      }

      const totalChanges =
        preview.epics.create.length +
        preview.epics.update.length +
        preview.epics.close.length +
        preview.tasks.create.length +
        preview.tasks.update.length +
        preview.tasks.close.length +
        preview.milestones.create.length +
        preview.milestones.update.length +
        preview.milestones.close.length;

      if (totalChanges === 0) {
        console.log(chalk.green("\\n✅ No changes needed - everything is already in sync"));
      } else {
        console.log(
          chalk.blue("\\n💡 Run without --github-dry-run or --dry-run to apply these changes"),
        );
      }
    } else {
      console.log(chalk.blue("🚀 Syncing to GitHub..."));

      const syncResults = await githubClient.syncToGitHub(epics, false);

      const created = syncResults.filter((r) => r.action === "created");
      const updated = syncResults.filter((r) => r.action === "updated");
      const closed = syncResults.filter((r) => r.action === "closed");
      const skipped = syncResults.filter((r) => r.action === "skipped");

      console.log(chalk.green("\\n✅ GitHub Sync Complete:"));

      if (created.length > 0) {
        console.log(chalk.cyan(`  📝 Created: ${created.length} items`));
        created.forEach((result) => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`),
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (updated.length > 0) {
        console.log(chalk.yellow(`  📝 Updated: ${updated.length} items`));
        updated.forEach((result) => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`),
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (closed.length > 0) {
        console.log(chalk.red(`  📝 Closed: ${closed.length} items`));
        closed.forEach((result) => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`),
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (skipped.length > 0 && options.verbose) {
        console.log(chalk.dim(`  ⏭️  Skipped: ${skipped.length} items (no changes needed)`));
      }

      console.log(
        chalk.green(
          `\\n🔗 Check your GitHub repository: https://github.com/${finalRepo.owner}/${finalRepo.repo}/issues`,
        ),
      );
    }
  } catch (error) {
    console.error(
      chalk.red("❌ GitHub sync failed:"),
      error instanceof Error ? error.message : String(error),
    );
    if (options.verbose) {
      console.error(chalk.dim("Full error:"), error);
    }

    console.log(chalk.dim("\\nTroubleshooting tips:"));
    console.log(
      chalk.dim("  • Ensure GITHUB_TOKEN environment variable is set with proper permissions"),
    );
    console.log(chalk.dim("  • Verify your GitHub token has 'repo' or 'issues:write' permission"));
    console.log(chalk.dim("  • Check that the repository owner/name is correct"));
    console.log(chalk.dim("  • Ensure Git remote origin points to the correct GitHub repository"));
    console.log(chalk.dim("  • Use --verbose for more error details"));
    console.log(
      chalk.dim("  • Use --use-config or --use-git-remote to resolve repository conflicts"),
    );
  }
}
