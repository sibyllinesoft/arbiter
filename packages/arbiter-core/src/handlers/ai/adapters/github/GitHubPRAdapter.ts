import type { WebhookEvent } from '../../../shared/utils.js';
import type { WebhookEventData } from '../../base/types.js';
import { BaseHookAdapter } from '../base/IHookAdapter.js';

/**
 * GitHub Pull Request adapter for AI processing
 *
 * Extracts structured data from GitHub PR webhooks including:
 * - PR details (title, body, state, branches)
 * - File changes and statistics
 * - Author and reviewer information
 * - Comments and reviews
 */
export class GitHubPRAdapter extends BaseHookAdapter {
  readonly provider = 'github';
  readonly eventType = 'pull_request';

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;

      // Validate required fields
      const errors = this.validatePayload(payload, [
        'pull_request',
        'pull_request.number',
        'pull_request.title',
        'repository',
      ]);

      if (errors.length > 0) {
        return this.createErrorResponse(`Validation failed: ${errors.join(', ')}`);
      }

      const pr = payload.pull_request;
      const repository = this.extractRepositoryInfo(payload);
      const user = this.extractUserInfo(payload, 'author');

      if (!repository || !user) {
        return this.createErrorResponse('Failed to extract repository or user information');
      }

      // Extract PR-specific data
      const pullRequest = {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state as 'open' | 'closed' | 'merged',
        draft: pr.draft || false,
        sourceBranch: pr.head?.ref || 'unknown',
        targetBranch: pr.base?.ref || repository.defaultBranch,
        url: pr.html_url,
        commits: pr.commits || 0,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changed_files || 0,

        // Additional PR metadata
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state,
        merged: pr.merged || false,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,

        // Labels and assignees
        labels: (pr.labels || []).map((label: any) => label.name),
        assignees: (pr.assignees || []).map((assignee: any) => assignee.login),
        requestedReviewers: (pr.requested_reviewers || []).map((reviewer: any) => reviewer.login),

        // Branch information
        headSha: pr.head?.sha,
        baseSha: pr.base?.sha,
        headRepo: pr.head?.repo?.full_name,
        baseRepo: pr.base?.repo?.full_name,

        // Review state
        reviewComments: pr.review_comments || 0,
        comments: pr.comments || 0,
      };

      // Include action context (opened, closed, synchronize, etc.)
      const action = payload.action;
      const actionData = {
        action,
        isOpened: action === 'opened',
        isClosed: action === 'closed',
        isSynchronized: action === 'synchronize',
        isReopened: action === 'reopened',
        isReadyForReview: action === 'ready_for_review',
        isConverted: action === 'converted_to_draft',
      };

      return this.createSuccessResponse({
        repository,
        user,
        pullRequest,
        action: actionData,

        // Additional event context
        eventType: 'pull_request',
        timestamp: event.timestamp,

        // Raw payload for advanced processing
        raw: payload,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract GitHub PR data: ${errorMessage}`);
    }
  }

  getMetadata() {
    return {
      name: 'github-pr-adapter',
      version: '1.0.0',
      description: 'Extracts structured data from GitHub Pull Request webhooks for AI processing',
      supportedEvents: ['pull_request'],
    };
  }
}

/**
 * GitHub Pull Request Review adapter for AI processing
 *
 * Handles PR review events (submitted, dismissed, edited)
 */
export class GitHubPRReviewAdapter extends BaseHookAdapter {
  readonly provider = 'github';
  readonly eventType = 'pull_request_review';

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;

      const errors = this.validatePayload(payload, ['pull_request', 'review', 'repository']);

      if (errors.length > 0) {
        return this.createErrorResponse(`Validation failed: ${errors.join(', ')}`);
      }

      const pr = payload.pull_request;
      const review = payload.review;
      const repository = this.extractRepositoryInfo(payload);
      const user = this.extractUserInfo(payload, 'sender');

      if (!repository || !user) {
        return this.createErrorResponse('Failed to extract repository or user information');
      }

      const pullRequest = {
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: pr.state as 'open' | 'closed' | 'merged',
        sourceBranch: pr.head?.ref || 'unknown',
        targetBranch: pr.base?.ref || repository.defaultBranch,
        url: pr.html_url,
      };

      const reviewData = {
        id: review.id,
        body: review.body || '',
        state: review.state, // 'approved', 'changes_requested', 'commented'
        author: {
          login: review.user?.login,
          name: review.user?.name,
          avatarUrl: review.user?.avatar_url,
        },
        submittedAt: review.submitted_at,
        url: review.html_url,
      };

      return this.createSuccessResponse({
        repository,
        user,
        pullRequest,
        review: reviewData,
        action: payload.action,

        eventType: 'pull_request_review',
        timestamp: event.timestamp,
        raw: payload,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract GitHub PR review data: ${errorMessage}`);
    }
  }
}
