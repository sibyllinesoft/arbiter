import type { HandlerResponse, WebhookEvent } from "../shared/utils.js";
import { createResponse, logEvent, validatePayload } from "../shared/utils.js";

export interface GitLabMRPayload {
  object_kind: "merge_request";
  event_type: "merge_request";
  project: {
    id: number;
    name: string;
    namespace: string;
    path_with_namespace: string;
    web_url: string;
  };
  object_attributes: {
    id: number;
    iid: number;
    title: string;
    description: string;
    state: "opened" | "closed" | "merged";
    action:
      | "open"
      | "close"
      | "reopen"
      | "update"
      | "approved"
      | "unapproved"
      | "approval"
      | "unapproval"
      | "merge";
    source_branch: string;
    target_branch: string;
    source_project_id: number;
    target_project_id: number;
    author_id: number;
    assignee_id: number | null;
    created_at: string;
    updated_at: string;
    merge_status: "unchecked" | "checking" | "can_be_merged" | "cannot_be_merged";
    work_in_progress: boolean;
    draft: boolean;
  };
  user: {
    id: number;
    name: string;
    username: string;
    email: string;
  };
}

/**
 * GitLab Merge Request Event Handler
 *
 * Handles GitLab MR events including validation of branch naming,
 * MR titles, and enforces development workflow rules.
 */
export async function handleGitLabMR(event: WebhookEvent): Promise<HandlerResponse> {
  try {
    // Validate the payload structure
    const validationResult = validatePayload(event.payload, [
      "object_kind",
      "object_attributes",
      "project",
      "user",
    ]);
    if (!validationResult.isValid) {
      return createResponse(false, `Invalid payload: ${validationResult.errors.join(", ")}`);
    }

    const payload = event.payload as GitLabMRPayload;
    const { object_attributes: mr, project, user } = payload;

    // Ensure it's a merge request event
    if (payload.object_kind !== "merge_request") {
      return createResponse(false, `Expected merge_request event, got: ${payload.object_kind}`);
    }

    // Log the MR event
    await logEvent({
      type: "gitlab.merge_request",
      timestamp: new Date().toISOString(),
      project: project.path_with_namespace,
      action: mr.action,
      mrIid: mr.iid,
      title: mr.title,
      author: user.username,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      state: mr.state,
    });

    // Validate branch naming and workflow rules for open/update actions
    if (mr.action === "open" || mr.action === "update") {
      const sourceBranch = mr.source_branch;
      const targetBranch = mr.target_branch;

      // Check feature branch naming
      if (sourceBranch.startsWith("feature/")) {
        const featureBranchPattern = /^feature\/[a-z0-9-]+$/;
        if (!featureBranchPattern.test(sourceBranch)) {
          return createResponse(
            false,
            `Invalid feature branch naming: ${sourceBranch}. Use format: feature/your-feature-name`,
          );
        }
      }

      // Check hotfix branch naming
      if (sourceBranch.startsWith("hotfix/")) {
        const hotfixBranchPattern = /^hotfix\/[a-z0-9-]+$/;
        if (!hotfixBranchPattern.test(sourceBranch)) {
          return createResponse(
            false,
            `Invalid hotfix branch naming: ${sourceBranch}. Use format: hotfix/your-fix-name`,
          );
        }
      }

      // Validate MR title follows conventional commit format
      const conventionalTitlePattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
      if (!conventionalTitlePattern.test(mr.title)) {
        return createResponse(
          false,
          `MR title should follow conventional commit format. Current: "${mr.title}"`,
        );
      }

      // Check if MR description is provided for non-draft MRs
      if (
        !mr.draft &&
        !mr.work_in_progress &&
        (!mr.description || mr.description.trim().length < 10)
      ) {
        return createResponse(
          false,
          "MR description is required and should be at least 10 characters long",
        );
      }

      // Validate target branch
      const allowedTargetBranches = ["main", "master", "develop", "staging"];
      if (!allowedTargetBranches.includes(targetBranch)) {
        return createResponse(
          false,
          `Invalid target branch: ${targetBranch}. Allowed: ${allowedTargetBranches.join(", ")}`,
        );
      }

      // Check for direct merges to main/master (should use develop)
      if (["main", "master"].includes(targetBranch) && !sourceBranch.startsWith("hotfix/")) {
        return createResponse(
          false,
          'Feature branches should target "develop" branch, not main/master directly (except for hotfixes)',
        );
      }

      // Check merge status for merge-ready MRs
      if (!mr.work_in_progress && !mr.draft && mr.merge_status === "cannot_be_merged") {
        return createResponse(
          false,
          "Merge conflicts detected. Please resolve conflicts before proceeding.",
        );
      }
    }

    // Handle specific actions
    let message = `Processed ${mr.action} action for MR !${mr.iid}`;
    const metadata: Record<string, any> = {
      project: project.path_with_namespace,
      mrIid: mr.iid,
      action: mr.action,
      state: mr.state,
      title: mr.title,
      author: user.username,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      mergeStatus: mr.merge_status,
    };

    switch (mr.action) {
      case "open":
        message = `New MR opened: "${mr.title}" (!${mr.iid})`;
        metadata.isDraft = mr.draft || mr.work_in_progress;
        break;

      case "merge":
        message = `MR merged: "${mr.title}" (!${mr.iid})`;
        metadata.merged = true;

        // Log successful merge
        await logEvent({
          type: "gitlab.mr.merged",
          timestamp: new Date().toISOString(),
          project: project.path_with_namespace,
          mrIid: mr.iid,
          title: mr.title,
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
        });
        break;

      case "close":
        message = `MR closed: "${mr.title}" (!${mr.iid})`;
        metadata.merged = mr.state === "merged";
        break;

      case "update":
        message = `MR updated: "${mr.title}" (!${mr.iid})`;
        break;

      case "reopen":
        message = `MR reopened: "${mr.title}" (!${mr.iid})`;
        break;

      case "approved":
      case "unapproved":
      case "approval":
      case "unapproval":
        message = `MR ${mr.action}: "${mr.title}" (!${mr.iid})`;
        metadata.approvalAction = mr.action;
        break;
    }

    return createResponse(true, message, metadata);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logEvent({
      type: "gitlab.mr.error",
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });

    return createResponse(false, `Handler error: ${errorMessage}`);
  }
}

export const config = {
  name: "gitlab-mr-handler",
  description: "Handles GitLab merge request events with branch naming and workflow validation",
  version: "1.0.0",
  events: ["merge_request"],
  provider: "gitlab",
  enabled: true,
};
