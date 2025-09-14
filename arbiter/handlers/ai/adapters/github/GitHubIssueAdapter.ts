import type { WebhookEvent } from '../../../shared/utils.js';
import type { WebhookEventData } from '../../base/types.js';
import { BaseHookAdapter } from '../base/IHookAdapter.js';

/**
 * GitHub Issues adapter for AI processing
 * 
 * Extracts structured data from GitHub Issue webhooks including:
 * - Issue details (title, body, state, labels)
 * - Author and assignee information
 * - Milestone and project associations
 * - Comments and activity
 */
export class GitHubIssueAdapter extends BaseHookAdapter {
  readonly provider = 'github';
  readonly eventType = 'issues';

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;
      
      // Validate required fields
      const errors = this.validatePayload(payload, [
        'issue',
        'issue.number',
        'issue.title',
        'repository'
      ]);
      
      if (errors.length > 0) {
        return this.createErrorResponse(`Validation failed: ${errors.join(', ')}`);
      }

      const issue = payload.issue;
      const repository = this.extractRepositoryInfo(payload);
      const user = this.extractUserInfo(payload, 'author');

      if (!repository || !user) {
        return this.createErrorResponse('Failed to extract repository or user information');
      }

      // Extract issue-specific data
      const issueData = {
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state as 'open' | 'closed',
        labels: (issue.labels || []).map((label: any) => label.name),
        assignees: (issue.assignees || []).map((assignee: any) => assignee.login),
        url: issue.html_url,
        
        // Additional issue metadata
        locked: issue.locked || false,
        comments: issue.comments || 0,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at,
        
        // Author information
        author: {
          login: issue.user?.login,
          name: issue.user?.name,
          avatarUrl: issue.user?.avatar_url,
          type: issue.user?.type, // 'User', 'Bot', etc.
        },
        
        // Milestone information
        milestone: issue.milestone ? {
          number: issue.milestone.number,
          title: issue.milestone.title,
          description: issue.milestone.description,
          state: issue.milestone.state,
          dueOn: issue.milestone.due_on,
        } : null,
        
        // Reactions
        reactions: {
          totalCount: issue.reactions?.total_count || 0,
          plusOne: issue.reactions?.['+1'] || 0,
          minusOne: issue.reactions?.['-1'] || 0,
          laugh: issue.reactions?.laugh || 0,
          confused: issue.reactions?.confused || 0,
          heart: issue.reactions?.heart || 0,
          hooray: issue.reactions?.hooray || 0,
          eyes: issue.reactions?.eyes || 0,
        },
      };

      // Include action context (opened, closed, edited, etc.)
      const action = payload.action;
      const actionData = {
        action,
        isOpened: action === 'opened',
        isClosed: action === 'closed',
        isEdited: action === 'edited',
        isReopened: action === 'reopened',
        isAssigned: action === 'assigned',
        isUnassigned: action === 'unassigned',
        isLabeled: action === 'labeled',
        isUnlabeled: action === 'unlabeled',
        
        // Additional context for specific actions
        assignee: payload.assignee?.login,
        label: payload.label?.name,
      };

      return this.createSuccessResponse({
        repository,
        user,
        issue: issueData,
        action: actionData,
        
        // Additional event context
        eventType: 'issues',
        timestamp: event.timestamp,
        
        // Raw payload for advanced processing
        raw: payload,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract GitHub issue data: ${errorMessage}`);
    }
  }

  getMetadata() {
    return {
      name: 'github-issue-adapter',
      version: '1.0.0',
      description: 'Extracts structured data from GitHub Issues webhooks for AI processing',
      supportedEvents: ['issues'],
    };
  }
}

/**
 * GitHub Issue Comment adapter for AI processing
 * 
 * Handles issue comment events (created, edited, deleted)
 */
export class GitHubIssueCommentAdapter extends BaseHookAdapter {
  readonly provider = 'github';
  readonly eventType = 'issue_comment';

  async extractEventData(event: WebhookEvent): Promise<WebhookEventData> {
    try {
      const payload = event.payload;
      
      const errors = this.validatePayload(payload, [
        'issue',
        'comment',
        'repository'
      ]);
      
      if (errors.length > 0) {
        return this.createErrorResponse(`Validation failed: ${errors.join(', ')}`);
      }

      const issue = payload.issue;
      const comment = payload.comment;
      const repository = this.extractRepositoryInfo(payload);
      const user = this.extractUserInfo(payload, 'sender');

      if (!repository || !user) {
        return this.createErrorResponse('Failed to extract repository or user information');
      }

      const issueData = {
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state as 'open' | 'closed',
        labels: (issue.labels || []).map((label: any) => label.name),
        assignees: (issue.assignees || []).map((assignee: any) => assignee.login),
        url: issue.html_url,
        isPullRequest: !!issue.pull_request, // Issue comment can be on PR
      };

      const commentData = {
        id: comment.id,
        body: comment.body,
        author: {
          login: comment.user?.login,
          name: comment.user?.name,
          avatarUrl: comment.user?.avatar_url,
          type: comment.user?.type,
        },
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        url: comment.html_url,
        
        // Reactions on the comment
        reactions: {
          totalCount: comment.reactions?.total_count || 0,
          plusOne: comment.reactions?.['+1'] || 0,
          minusOne: comment.reactions?.['-1'] || 0,
          laugh: comment.reactions?.laugh || 0,
          confused: comment.reactions?.confused || 0,
          heart: comment.reactions?.heart || 0,
          hooray: comment.reactions?.hooray || 0,
          eyes: comment.reactions?.eyes || 0,
        },
      };

      return this.createSuccessResponse({
        repository,
        user,
        issue: issueData,
        comment: commentData,
        action: payload.action,
        
        eventType: 'issue_comment',
        timestamp: event.timestamp,
        raw: payload,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResponse(`Failed to extract GitHub issue comment data: ${errorMessage}`);
    }
  }

  getMetadata() {
    return {
      name: 'github-issue-comment-adapter',
      version: '1.0.0',
      description: 'Extracts structured data from GitHub Issue Comment webhooks for AI processing',
      supportedEvents: ['issue_comment'],
    };
  }
}