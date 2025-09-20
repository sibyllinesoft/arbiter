import type { WebhookEvent } from "../../../shared/utils.js";
import type { WebhookEventData } from "../../base/types.js";
import { BaseHookAdapter } from "../base/IHookAdapter.js";

type CommitSummary = {
  id: string;
  message: string;
  author?: string;
  email?: string;
  url: string;
  timestamp: string;
  added: string[];
  removed: string[];
  modified: string[];
  distinct: boolean;
};

/**
 * GitHub Push adapter for AI processing
 *
 * Extracts structured data from GitHub Push webhooks including:
 * - Branch and commit information
 * - Changed files and statistics
 * - Author and committer details
 * - Push context (force push, branch creation/deletion)
 */
export class GitHubPushAdapter extends BaseHookAdapter {
  readonly provider = "github";
  readonly eventType = "push";

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;

      // Validate required fields
      const errors = this.validatePayload(payload, ["ref", "repository", "pusher"]);

      if (errors.length > 0) {
        return this.createErrorResponse(`Validation failed: ${errors.join(", ")}`);
      }

      const repository = this.extractRepositoryInfo(payload);
      const user = this.extractUserInfo(payload, "pusher");

      if (!repository || !user) {
        return this.createErrorResponse("Failed to extract repository or user information");
      }

      // Extract branch name from ref
      const branch = payload.ref.replace("refs/heads/", "");

      // Determine push type
      const isNewBranch = payload.before === "0000000000000000000000000000000000000000";
      const isBranchDeletion = payload.after === "0000000000000000000000000000000000000000";
      const isForcePush = payload.forced || false;

      // Extract commit information
      const commits: CommitSummary[] = (payload.commits || []).map((commit: any) => ({
        id: commit.id,
        message: commit.message,
        author: commit.author?.name || commit.author?.username,
        email: commit.author?.email,
        url: commit.url,
        timestamp: commit.timestamp,

        // Commit statistics
        added: commit.added || [],
        removed: commit.removed || [],
        modified: commit.modified || [],

        // Distinct commits (for merge commits)
        distinct: Boolean(commit.distinct),
      }));

      const pushData = {
        branch,
        commits,
        before: payload.before,
        after: payload.after,

        // Push context
        isNewBranch,
        isBranchDeletion,
        isForcePush,
        isTag: payload.ref.startsWith("refs/tags/"),

        // Branch analysis
        isProtectedBranch: ["main", "master", "develop", "staging"].includes(branch.toLowerCase()),
        isFeatureBranch: branch.startsWith("feature/"),
        isHotfixBranch: branch.startsWith("hotfix/"),
        isBugfixBranch: branch.startsWith("bugfix/"),
        isReleaseBranch: branch.startsWith("release/"),

        // Statistics
        commitCount: commits.length,
        distinctCommitCount: commits.filter((c) => c.distinct).length,

        // Head commit details
        headCommit: payload.head_commit
          ? {
              id: payload.head_commit.id,
              message: payload.head_commit.message,
              author: payload.head_commit.author,
              committer: payload.head_commit.committer,
              timestamp: payload.head_commit.timestamp,
              url: payload.head_commit.url,
              added: payload.head_commit.added || [],
              removed: payload.head_commit.removed || [],
              modified: payload.head_commit.modified || [],
            }
          : null,

        // Compare URL for viewing changes
        compareUrl: payload.compare,
      };

      // Analyze commit messages for patterns
      const conventionalCommits = commits.filter((commit) =>
        /^(feat|fix|docs|style|refactor|test|chore|ci|perf|revert)(\(.+\))?: .+/.test(
          commit.message,
        ),
      );

      const analysisData = {
        hasConventionalCommits: conventionalCommits.length > 0,
        conventionalCommitRatio:
          commits.length > 0 ? conventionalCommits.length / commits.length : 0,

        // Commit message analysis
        commitTypes: this.analyzeCommitTypes(commits),

        // File change analysis
        fileChanges: this.analyzeFileChanges(commits),
      };

      return this.createSuccessResponse({
        repository,
        user,
        push: pushData,
        analysis: analysisData,

        // Additional event context
        eventType: "push",
        timestamp: event.timestamp,

        // Raw payload for advanced processing
        raw: payload,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.createErrorResponse(`Failed to extract GitHub push data: ${errorMessage}`);
    }
  }

  /**
   * Analyze commit message types and patterns
   */
  private analyzeCommitTypes(commits: any[]): {
    types: Record<string, number>;
    hasBreakingChanges: boolean;
    averageMessageLength: number;
  } {
    const types: Record<string, number> = {};
    let hasBreakingChanges = false;
    let totalLength = 0;

    for (const commit of commits) {
      const message = commit.message;
      totalLength += message.length;

      // Check for breaking changes
      if (message.includes("BREAKING CHANGE") || message.includes("!:")) {
        hasBreakingChanges = true;
      }

      // Extract conventional commit type
      const match = message.match(
        /^(feat|fix|docs|style|refactor|test|chore|ci|perf|revert)(\(.+\))?:/,
      );
      if (match) {
        const type = match[1];
        types[type] = (types[type] || 0) + 1;
      } else {
        types.other = (types.other || 0) + 1;
      }
    }

    return {
      types,
      hasBreakingChanges,
      averageMessageLength: commits.length > 0 ? totalLength / commits.length : 0,
    };
  }

  /**
   * Analyze file changes across commits
   */
  private analyzeFileChanges(commits: any[]): {
    totalFilesChanged: number;
    fileTypes: Record<string, number>;
    hasConfigChanges: boolean;
    hasTestChanges: boolean;
    hasDocumentationChanges: boolean;
  } {
    const allFiles = new Set<string>();
    const fileTypes: Record<string, number> = {};
    let hasConfigChanges = false;
    let hasTestChanges = false;
    let hasDocumentationChanges = false;

    for (const commit of commits) {
      const files = [
        ...(commit.added || []),
        ...(commit.removed || []),
        ...(commit.modified || []),
      ];

      for (const file of files) {
        allFiles.add(file);

        // Get file extension
        const ext = file.split(".").pop()?.toLowerCase() || "no-ext";
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;

        // Detect special file types
        if (file.match(/\.(json|yaml|yml|toml|ini|config)$/i) || file.includes("config")) {
          hasConfigChanges = true;
        }

        if (file.match(/\.(test|spec)\./i) || file.includes("test") || file.includes("spec")) {
          hasTestChanges = true;
        }

        if (file.match(/\.(md|txt|rst)$/i) || file.includes("README") || file.includes("docs")) {
          hasDocumentationChanges = true;
        }
      }
    }

    return {
      totalFilesChanged: allFiles.size,
      fileTypes,
      hasConfigChanges,
      hasTestChanges,
      hasDocumentationChanges,
    };
  }

  getMetadata() {
    return {
      name: "github-push-adapter",
      version: "1.0.0",
      description: "Extracts structured data from GitHub Push webhooks for AI processing",
      supportedEvents: ["push"],
    };
  }
}
