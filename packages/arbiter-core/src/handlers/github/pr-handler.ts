import type { HandlerResponse, WebhookEvent } from "../shared/utils.js";
import { createResponse, logEvent, validatePayload } from "../shared/utils.js";

export interface GitHubPRPayload {
  action: "opened" | "closed" | "reopened" | "synchronize" | "edited";
  number: number;
  pull_request: {
    id: number;
    title: string;
    body: string;
    head: {
      ref: string;
      sha: string;
    };
    base: {
      ref: string;
    };
    user: {
      login: string;
    };
    draft: boolean;
    mergeable: boolean | null;
    merged: boolean;
    state: "open" | "closed";
  };
  repository: {
    name: string;
    full_name: string;
  };
}

/**
 * GitHub Pull Request Event Handler
 *
 * Handles PR events including validation of branch naming,
 * PR titles, and enforces development workflow rules.
 */
export async function handleGitHubPR(event: WebhookEvent): Promise<HandlerResponse> {
  try {
    // Validate the payload structure
    const validationResult = validatePayload(event.payload, [
      "action",
      "pull_request",
      "repository",
    ]);
    if (!validationResult.isValid) {
      return createResponse(false, `Invalid payload: ${validationResult.errors.join(", ")}`);
    }

    const payload = event.payload as GitHubPRPayload;
    const { action, pull_request: pr, repository } = payload;

    // Log the PR event
    await logEvent({
      type: "github.pr",
      timestamp: new Date().toISOString(),
      repository: repository.full_name,
      action,
      prNumber: payload.number,
      title: pr.title,
      author: pr.user.login,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
    });

    // Validate branch naming for feature branches
    if (action === "opened" || action === "synchronize") {
      const sourceBranch = pr.head.ref;

      // Check if it's a feature branch
      if (sourceBranch.startsWith("feature/")) {
        const featureBranchPattern = /^feature\/[a-z0-9-]+$/;
        if (!featureBranchPattern.test(sourceBranch)) {
          return createResponse(
            false,
            `Invalid feature branch naming: ${sourceBranch}. Use format: feature/your-feature-name`,
          );
        }
      }

      // Check if it's a hotfix branch
      if (sourceBranch.startsWith("hotfix/")) {
        const hotfixBranchPattern = /^hotfix\/[a-z0-9-]+$/;
        if (!hotfixBranchPattern.test(sourceBranch)) {
          return createResponse(
            false,
            `Invalid hotfix branch naming: ${sourceBranch}. Use format: hotfix/your-fix-name`,
          );
        }
      }

      // Validate PR title follows conventional commit format
      const conventionalTitlePattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
      if (!conventionalTitlePattern.test(pr.title)) {
        return createResponse(
          false,
          `PR title should follow conventional commit format. Current: "${pr.title}"`,
        );
      }

      // Check if PR body is provided for non-draft PRs
      if (!pr.draft && (!pr.body || pr.body.trim().length < 10)) {
        return createResponse(
          false,
          "PR description is required and should be at least 10 characters long",
        );
      }

      // Validate target branch
      const allowedTargetBranches = ["main", "master", "develop", "staging"];
      if (!allowedTargetBranches.includes(pr.base.ref)) {
        return createResponse(
          false,
          `Invalid target branch: ${pr.base.ref}. Allowed: ${allowedTargetBranches.join(", ")}`,
        );
      }

      // Check for direct pushes to main/master (should use develop)
      if (["main", "master"].includes(pr.base.ref) && !sourceBranch.startsWith("hotfix/")) {
        if (!["develop", "staging"].includes(pr.base.ref)) {
          return createResponse(
            false,
            'Feature branches should target "develop" branch, not main/master directly',
          );
        }
      }
    }

    // Handle specific actions
    let message = `Processed ${action} action for PR #${payload.number}`;
    const metadata: Record<string, any> = {
      repository: repository.full_name,
      prNumber: payload.number,
      action,
      title: pr.title,
      author: pr.user.login,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
    };

    switch (action) {
      case "opened":
        message = `New PR opened: "${pr.title}" (#${payload.number})`;
        metadata.isDraft = pr.draft;
        break;

      case "closed":
        if (pr.merged) {
          message = `PR merged: "${pr.title}" (#${payload.number})`;
          metadata.merged = true;

          // Log successful merge
          await logEvent({
            type: "github.pr.merged",
            timestamp: new Date().toISOString(),
            repository: repository.full_name,
            prNumber: payload.number,
            title: pr.title,
            sourceBranch: pr.head.ref,
            targetBranch: pr.base.ref,
          });
        } else {
          message = `PR closed without merging: "${pr.title}" (#${payload.number})`;
          metadata.merged = false;
        }
        break;

      case "synchronize":
        message = `PR updated with new commits: "${pr.title}" (#${payload.number})`;
        metadata.headCommit = pr.head.sha;
        break;

      case "reopened":
        message = `PR reopened: "${pr.title}" (#${payload.number})`;
        break;

      case "edited":
        message = `PR edited: "${pr.title}" (#${payload.number})`;
        break;
    }

    return createResponse(true, message, metadata);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logEvent({
      type: "github.pr.error",
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });

    return createResponse(false, `Handler error: ${errorMessage}`);
  }
}

export const config = {
  name: "github-pr-handler",
  description: "Handles GitHub PR events with branch naming and workflow validation",
  version: "1.0.0",
  events: ["pull_request"],
  provider: "github",
  enabled: true,
};
