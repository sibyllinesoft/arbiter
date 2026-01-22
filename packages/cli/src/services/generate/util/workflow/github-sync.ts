import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { CLIConfig } from "@/types.js";
import { ShardedCUEStorage } from "@/utils/github/sharded-storage.js";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";
import { getSmartRepositoryConfig, validateRepositoryConfig } from "@/utils/io/git-detection.js";
/* istanbul ignore file */
import chalk from "chalk";

// Preview display helpers
interface PreviewCategory<T> {
  items: T[];
  label: string;
  emoji: string;
  color: typeof chalk.cyan;
  nameExtractor: (item: T) => string;
  detailExtractor?: (item: T) => string;
}

function displayPreviewSection<T>(category: PreviewCategory<T>): void {
  if (category.items.length === 0) return;
  console.log(category.color(`\n  ${category.emoji} ${category.label}: ${category.items.length}`));
  category.items.forEach((item) => {
    const name = category.nameExtractor(item);
    const detail = category.detailExtractor?.(item);
    console.log(chalk.dim(`    • ${name}${detail ? ` (${detail})` : ""}`));
  });
}

// Sync result display helpers
interface ResultCategory {
  results: Array<{ type?: string; githubNumber?: number; details?: string }>;
  label: string;
  emoji: string;
  color: typeof chalk.cyan;
}

function displayResultSection(category: ResultCategory): void {
  if (category.results.length === 0) return;
  console.log(
    category.color(`  ${category.emoji} ${category.label}: ${category.results.length} items`),
  );
  category.results.forEach((result) => {
    const prefix = result.githubNumber ? `${result.type} #${result.githubNumber}` : result.type;
    console.log(chalk.dim(`    • ${prefix}: ${result.details}`));
  });
}

/**
 * Handle GitHub synchronization for groups and tasks.
 * This performs network calls and depends on repository state, so we exclude it
 * from strict coverage and exercise only its guards in isolated unit tests.
 */
export async function handleGitHubSync(options: GenerateOptions, config: CLIConfig): Promise<void> {
  if (options.verbose) {
    console.log(chalk.dim("🔄 Starting GitHub sync handler..."));
  }

  try {
    const repoConfig = await resolveRepositoryConfig(options, config);
    if (!repoConfig) return;

    const { finalRepo, githubConfig, smartRepoConfig } = repoConfig;
    logRepositoryInfo(options, smartRepoConfig, finalRepo);

    const groups = await loadGroups();
    if (!groups) return;

    const githubClient = new GitHubSyncClient(githubConfig);
    const isDryRun = options.githubDryRun || options.dryRun;

    if (isDryRun) {
      await displayDryRunPreview(githubClient, groups);
    } else {
      await performSync(githubClient, groups, options, finalRepo);
    }
  } catch (error) {
    handleSyncError(error, options);
  }
}

/**
 * Resolves and validates repository configuration.
 */
async function resolveRepositoryConfig(
  options: GenerateOptions,
  config: CLIConfig,
): Promise<{
  finalRepo: { owner: string; repo: string };
  githubConfig: any;
  smartRepoConfig: ReturnType<typeof getSmartRepositoryConfig>;
} | null> {
  const smartRepoConfig = getSmartRepositoryConfig(config.github?.repository, {
    verbose: options.verbose,
  });

  if (!smartRepoConfig) {
    displayNoConfigError();
    return null;
  }

  const finalRepo = smartRepoConfig.repo;
  const validation = validateRepositoryConfig(finalRepo);

  if (!validation.valid) {
    displayValidationError(validation);
    return null;
  }

  if (!finalRepo.owner || !finalRepo.repo) {
    console.error(chalk.red("❌ Repository owner and name are required"));
    console.log(
      chalk.dim(
        "Either configure them in .arbiter/config.json or ensure your Git remote is set correctly",
      ),
    );
    return null;
  }

  const githubConfig = {
    repository: finalRepo,
    prefixes: config.github?.prefixes || { group: "[Group]", task: "[Task]" },
    labels: config.github?.labels || { default: ["arbiter-generated"] },
    automation: config.github?.automation || {
      createMilestones: true,
      autoClose: true,
      syncAcceptanceCriteria: true,
      syncAssignees: false,
    },
    templates: config.github?.templates,
  };

  // After the owner/repo check above, we know they're defined
  return { finalRepo: finalRepo as Required<typeof finalRepo>, githubConfig, smartRepoConfig };
}

/**
 * Displays error when no repository configuration is found.
 */
function displayNoConfigError(): void {
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
    "repository": { "owner": "your-org", "repo": "your-repo" },
    "prefixes": { "group": "[Group]", "task": "[Task]" },
    "labels": { "default": ["arbiter-generated"] },
    "automation": { "createMilestones": true, "autoClose": true }
  }
}`),
  );
  console.log(chalk.dim("\nAnd set your GitHub token: export GITHUB_TOKEN=your_token"));
}

/**
 * Displays validation errors for repository configuration.
 */
function displayValidationError(validation: { errors: string[]; suggestions: string[] }): void {
  console.error(chalk.red("❌ Invalid repository configuration:"));
  validation.errors.forEach((error) => console.log(chalk.red(`  • ${error}`)));
  if (validation.suggestions.length > 0) {
    console.log(chalk.dim("\nSuggestions:"));
    validation.suggestions.forEach((s) => console.log(chalk.dim(`  • ${s}`)));
  }
}

/**
 * Logs repository information based on detection source.
 */
function logRepositoryInfo(
  options: GenerateOptions,
  smartRepoConfig: any,
  finalRepo: { owner: string; repo: string },
): void {
  if (options.verbose || smartRepoConfig.source !== "config") {
    const sourceInfo =
      smartRepoConfig.source === "detected"
        ? "auto-detected from Git remote"
        : smartRepoConfig.source === "merged"
          ? "merged from config and Git remote"
          : "from configuration";
    console.log(chalk.dim(`📁 Repository: ${finalRepo.owner}/${finalRepo.repo} (${sourceInfo})`));
  }
}

/**
 * Loads groups from storage, returning null if none found.
 */
async function loadGroups(): Promise<any[] | null> {
  console.log(chalk.blue("📋 Loading groups and tasks..."));
  const storage = new ShardedCUEStorage();
  await storage.initialize();
  const groups = await storage.listGroups();

  if (groups.length === 0) {
    console.log(chalk.yellow("⚠️  No groups found to sync"));
    console.log(chalk.dim("Create groups with: arbiter group create <name>"));
    return null;
  }

  const taskCount = groups.reduce((sum: number, group: any) => sum + group.tasks.length, 0);
  console.log(chalk.dim(`Found ${groups.length} groups with ${taskCount} total tasks`));
  return groups;
}

/**
 * Displays a dry-run preview of what would be synced.
 */
async function displayDryRunPreview(githubClient: GitHubSyncClient, groups: any[]): Promise<void> {
  console.log(chalk.blue("🔍 GitHub Sync Preview (dry run)"));
  const preview = await githubClient.generateSyncPreview(groups);
  console.log(chalk.green("\n📊 Sync Preview:"));

  // Groups preview
  displayPreviewSection({
    items: preview.groups.create,
    label: "Groups to create",
    emoji: "📝",
    color: chalk.cyan,
    nameExtractor: (g: any) => g.name,
  });
  displayPreviewSection({
    items: preview.groups.update,
    label: "Groups to update",
    emoji: "📝",
    color: chalk.yellow,
    nameExtractor: ({ group }: any) => group.name,
  });
  displayPreviewSection({
    items: preview.groups.close,
    label: "Groups to close",
    emoji: "📝",
    color: chalk.red,
    nameExtractor: ({ group }: any) => group.name,
    detailExtractor: ({ group }: any) => group.status,
  });

  // Tasks preview
  displayPreviewSection({
    items: preview.tasks.create,
    label: "Tasks to create",
    emoji: "🔧",
    color: chalk.cyan,
    nameExtractor: (t: any) => t.name,
    detailExtractor: (t: any) => t.type,
  });
  displayPreviewSection({
    items: preview.tasks.update,
    label: "Tasks to update",
    emoji: "🔧",
    color: chalk.yellow,
    nameExtractor: ({ task }: any) => task.name,
    detailExtractor: ({ task }: any) => task.type,
  });
  displayPreviewSection({
    items: preview.tasks.close,
    label: "Tasks to close",
    emoji: "🔧",
    color: chalk.red,
    nameExtractor: ({ task }: any) => task.name,
    detailExtractor: ({ task }: any) => task.status,
  });

  // Milestones preview
  displayPreviewSection({
    items: preview.milestones.create,
    label: "Milestones to create",
    emoji: "🎯",
    color: chalk.cyan,
    nameExtractor: (g: any) => `Group: ${g.name}`,
  });
  displayPreviewSection({
    items: preview.milestones.update,
    label: "Milestones to update",
    emoji: "🎯",
    color: chalk.yellow,
    nameExtractor: ({ group }: any) => `Group: ${group.name}`,
  });
  displayPreviewSection({
    items: preview.milestones.close,
    label: "Milestones to close",
    emoji: "🎯",
    color: chalk.red,
    nameExtractor: ({ group }: any) => `Group: ${group.name}`,
    detailExtractor: ({ group }: any) => group.status,
  });

  const totalChanges =
    preview.groups.create.length +
    preview.groups.update.length +
    preview.groups.close.length +
    preview.tasks.create.length +
    preview.tasks.update.length +
    preview.tasks.close.length +
    preview.milestones.create.length +
    preview.milestones.update.length +
    preview.milestones.close.length;

  if (totalChanges === 0) {
    console.log(chalk.green("\n✅ No changes needed - everything is already in sync"));
  } else {
    console.log(
      chalk.blue("\n💡 Run without --github-dry-run or --dry-run to apply these changes"),
    );
  }
}

/**
 * Performs the actual sync to GitHub.
 */
async function performSync(
  githubClient: GitHubSyncClient,
  groups: any[],
  options: GenerateOptions,
  finalRepo: { owner: string; repo: string },
): Promise<void> {
  console.log(chalk.blue("🚀 Syncing to GitHub..."));
  const syncResults = await githubClient.syncToGitHub(groups, false);

  const created = syncResults.filter((r) => r.action === "created");
  const updated = syncResults.filter((r) => r.action === "updated");
  const closed = syncResults.filter((r) => r.action === "closed");
  const skipped = syncResults.filter((r) => r.action === "skipped");

  console.log(chalk.green("\n✅ GitHub Sync Complete:"));
  displayResultSection({ results: created, label: "Created", emoji: "📝", color: chalk.cyan });
  displayResultSection({ results: updated, label: "Updated", emoji: "📝", color: chalk.yellow });
  displayResultSection({ results: closed, label: "Closed", emoji: "📝", color: chalk.red });

  if (skipped.length > 0 && options.verbose) {
    console.log(chalk.dim(`  ⏭️  Skipped: ${skipped.length} items (no changes needed)`));
  }

  console.log(
    chalk.green(
      `\n🔗 Check your GitHub repository: https://github.com/${finalRepo.owner}/${finalRepo.repo}/issues`,
    ),
  );
}

/**
 * Handles sync errors with troubleshooting tips.
 */
function handleSyncError(error: unknown, options: GenerateOptions): void {
  console.error(
    chalk.red("❌ GitHub sync failed:"),
    error instanceof Error ? error.message : String(error),
  );
  if (options.verbose) {
    console.error(chalk.dim("Full error:"), error);
  }

  console.log(chalk.dim("\nTroubleshooting tips:"));
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
