import type { HandlerResponse, WebhookEvent } from '../shared/utils.js';
import { createResponse, logEvent, validatePayload } from '../shared/utils.js';

export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    name: string;
    full_name: string;
    html_url: string;
  };
  pusher: {
    name: string;
    email: string;
  };
  head_commit: {
    id: string;
    message: string;
    timestamp: string;
    author: {
      name: string;
      email: string;
    };
  } | null;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

/**
 * GitHub Push Event Handler
 *
 * Handles incoming push events from GitHub webhooks.
 * Logs push details and performs basic validation.
 */
export async function handleGitHubPush(event: WebhookEvent): Promise<HandlerResponse> {
  try {
    // Validate the payload structure
    const validationResult = validatePayload(event.payload, ['ref', 'repository', 'pusher']);
    if (!validationResult.isValid) {
      return createResponse(false, `Invalid payload: ${validationResult.errors.join(', ')}`);
    }

    const payload = event.payload as GitHubPushPayload;

    // Extract branch name from ref
    const branch = payload.ref.replace('refs/heads/', '');

    // Log the push event
    await logEvent({
      type: 'github.push',
      timestamp: new Date().toISOString(),
      repository: payload.repository.full_name,
      branch,
      pusher: payload.pusher.name,
      commitCount: payload.commits.length,
      headCommit: payload.head_commit?.id || 'deleted',
    });

    // Check for special branches
    const isMainBranch = ['main', 'master', 'develop'].includes(branch);
    const isFeatureBranch = branch.startsWith('feature/');
    const isHotfixBranch = branch.startsWith('hotfix/');

    let message = `Processed push to ${branch} in ${payload.repository.name}`;

    if (isMainBranch) {
      message += ' (protected branch detected)';

      // Additional validation for main branch pushes
      if (payload.commits.length > 10) {
        return createResponse(false, 'Too many commits pushed to protected branch at once');
      }
    }

    if (isFeatureBranch || isHotfixBranch) {
      // Validate branch naming convention
      const branchPattern = isFeatureBranch ? /^feature\/[a-z0-9-]+$/ : /^hotfix\/[a-z0-9-]+$/;

      if (!branchPattern.test(branch)) {
        return createResponse(false, `Branch naming convention violation: ${branch}`);
      }
    }

    // Check commit messages for conventional commits
    const invalidCommits = payload.commits.filter(commit => {
      const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
      return !conventionalPattern.test(commit.message);
    });

    if (invalidCommits.length > 0 && isMainBranch) {
      return createResponse(
        false,
        `Non-conventional commit messages found: ${invalidCommits.map(c => c.id.substring(0, 7)).join(', ')}`
      );
    }

    return createResponse(true, message, {
      repository: payload.repository.full_name,
      branch,
      commitCount: payload.commits.length,
      pusher: payload.pusher.name,
      isProtectedBranch: isMainBranch,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logEvent({
      type: 'github.push.error',
      timestamp: new Date().toISOString(),
      error: errorMessage,
    });

    return createResponse(false, `Handler error: ${errorMessage}`);
  }
}

export const config = {
  name: 'github-push-handler',
  description: 'Handles GitHub push events with branch protection and commit validation',
  version: '1.0.0',
  events: ['push'],
  provider: 'github',
  enabled: true,
};
