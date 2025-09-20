import type { WebhookEvent } from "../../../shared/utils.js";
import type { WebhookEventData } from "../../base/types.js";
import { BaseHookAdapter } from "../base/IHookAdapter.js";

/**
 * GitLab Merge Request adapter for AI processing
 *
 * Extracts structured data from GitLab MR webhooks including:
 * - MR details (title, description, state, branches)
 * - File changes and statistics
 * - Author and reviewer information
 * - Pipeline and approval status
 */
export class GitLabMRAdapter extends BaseHookAdapter {
  readonly provider = "gitlab";
  readonly eventType = "merge_request";

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;

      // Validate required fields
      const errors = this.validatePayload(payload, [
        "object_attributes",
        "object_attributes.iid",
        "object_attributes.title",
        "project",
      ]);

      if (errors.length > 0) {
        return this.createErrorResponse(`Validation failed: ${errors.join(", ")}`);
      }

      const mr = payload.object_attributes;
      const repository = this.extractRepositoryInfo(payload);
      const user = this.extractUserInfo(payload, "author");

      if (!repository || !user) {
        return this.createErrorResponse("Failed to extract repository or user information");
      }

      // Extract MR-specific data
      const pullRequest = {
        number: mr.iid,
        title: mr.title,
        body: mr.description || "",
        state: this.mapGitLabState(mr.state, mr.merge_status),
        draft: mr.work_in_progress || false,
        sourceBranch: mr.source_branch || "unknown",
        targetBranch: mr.target_branch || repository.defaultBranch,
        url: mr.url,
        commits: 0, // GitLab doesn't provide this directly in webhook
        additions: 0, // Would need separate API call
        deletions: 0, // Would need separate API call
        changedFiles: 0, // Would need separate API call

        // GitLab-specific fields
        mergeRequestId: mr.id,
        authorId: mr.author_id,
        assigneeId: mr.assignee_id,
        mergeUserId: mr.merge_user_id,
        milestoneId: mr.milestone_id,

        // State information
        mergeable: mr.merge_status === "can_be_merged",
        mergeableState: mr.merge_status,
        merged: mr.state === "merged",
        mergedAt: mr.merged_at,
        closedAt: mr.closed_at,
        createdAt: mr.created_at,
        updatedAt: mr.updated_at,

        // Branch information
        headSha: mr.last_commit?.id,
        baseSha: null, // Not directly available
        headRepo: mr.source?.path_with_namespace,
        baseRepo: mr.target?.path_with_namespace,

        // Additional metadata
        timeStats: {
          timeEstimate: mr.time_estimate,
          totalTimeSpent: mr.total_time_spent,
          humanTimeEstimate: mr.human_time_estimate,
          humanTotalTimeSpent: mr.human_total_time_spent,
        },

        // Approval information (GitLab Premium feature)
        approvalsRequired: mr.approvals_before_merge || 0,

        // Labels (if provided)
        labels: payload.labels ? payload.labels.map((label: any) => label.title) : [],
      };

      // Include action context
      const action = payload.object_kind === "merge_request" ? "updated" : payload.object_kind;
      const actionData = {
        action: mr.action || action,
        isOpened: mr.action === "open",
        isClosed: mr.action === "close",
        isMerged: mr.action === "merge",
        isReopened: mr.action === "reopen",
        isUpdated: mr.action === "update",

        // GitLab-specific actions
        isApproved: mr.action === "approved",
        isUnapproved: mr.action === "unapproved",
      };

      // Extract assignee and reviewer information
      const assigneeInfo = payload.assignees
        ? payload.assignees.map((assignee: any) => assignee.username)
        : payload.assignee
          ? [payload.assignee.username]
          : [];

      const reviewerInfo = payload.reviewers
        ? payload.reviewers.map((reviewer: any) => reviewer.username)
        : [];

      return this.createSuccessResponse({
        repository,
        user,
        pullRequest: {
          ...pullRequest,
          assignees: assigneeInfo,
          requestedReviewers: reviewerInfo,
        },
        action: actionData,

        // GitLab-specific context
        changes: payload.changes || {},

        // Additional event context
        eventType: "merge_request",
        timestamp: event.timestamp,

        // Raw payload for advanced processing
        raw: payload,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.createErrorResponse(`Failed to extract GitLab MR data: ${errorMessage}`);
    }
  }

  /**
   * Map GitLab states to standardized states
   */
  private mapGitLabState(state: string, mergeStatus?: string): "open" | "closed" | "merged" {
    switch (state) {
      case "opened":
        return "open";
      case "merged":
        return "merged";
      case "closed":
        return "closed";
      default:
        return "open";
    }
  }

  getMetadata() {
    return {
      name: "gitlab-mr-adapter",
      version: "1.0.0",
      description: "Extracts structured data from GitLab Merge Request webhooks for AI processing",
      supportedEvents: ["merge_request"],
    };
  }
}

/**
 * GitLab Push adapter for AI processing
 */
export class GitLabPushAdapter extends BaseHookAdapter {
  readonly provider = "gitlab";
  readonly eventType = "push";

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;

      const errors = this.validatePayload(payload, ["ref", "project", "user_name"]);

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

      // Extract commit information
      const commits = (payload.commits || []).map((commit: any) => ({
        id: commit.id,
        message: commit.message,
        author: commit.author?.name,
        email: commit.author?.email,
        url: commit.url,
        timestamp: commit.timestamp,

        // GitLab commit details
        added: commit.added || [],
        removed: commit.removed || [],
        modified: commit.modified || [],
      }));

      const pushData = {
        branch,
        commits,
        before: payload.before,
        after: payload.after,

        // Push context
        isNewBranch,
        isBranchDeletion,
        isForcePush: false, // GitLab doesn't provide this directly
        isTag: payload.ref.startsWith("refs/tags/"),

        // Branch analysis
        isProtectedBranch: ["main", "master", "develop", "staging"].includes(branch.toLowerCase()),
        isFeatureBranch: branch.startsWith("feature/"),
        isHotfixBranch: branch.startsWith("hotfix/"),
        isBugfixBranch: branch.startsWith("bugfix/"),
        isReleaseBranch: branch.startsWith("release/"),

        // Statistics
        commitCount: commits.length,
        totalCommitsCount: payload.total_commits_count || commits.length,

        // GitLab-specific fields
        checkoutSha: payload.checkout_sha,
        projectId: payload.project_id,
        repository: payload.repository,
      };

      return this.createSuccessResponse({
        repository,
        user,
        push: pushData,

        eventType: "push",
        timestamp: event.timestamp,
        raw: payload,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.createErrorResponse(`Failed to extract GitLab push data: ${errorMessage}`);
    }
  }

  getMetadata() {
    return {
      name: "gitlab-push-adapter",
      version: "1.0.0",
      description: "Extracts structured data from GitLab Push webhooks for AI processing",
      supportedEvents: ["push"],
    };
  }
}
