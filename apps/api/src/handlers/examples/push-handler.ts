/**
 * Example: Push event handler
 * Demonstrates the handler API and common patterns
 */

import type { HandlerModule, HandlerResult, WebhookHandler } from '../types.js';

// Handler function implementation
const handlePush: WebhookHandler = async (payload, context) => {
  const { logger, services, projectId } = context;
  const { parsed } = payload;

  logger.info('Processing push event', {
    repository: parsed.repository.fullName,
    ref: payload.ref,
    commits: parsed.commits?.length || 0,
  });

  const actions: string[] = [];

  try {
    // Example: Check for spec file changes
    const specChanges = parsed.commits?.some(
      commit =>
        commit.modified.some(file => file.endsWith('.cue')) ||
        commit.added.some(file => file.endsWith('.cue'))
    );

    if (specChanges) {
      logger.info('Spec files changed, triggering validation');

      // Trigger spec validation through events
      await services.events.broadcastToProject(projectId, {
        project_id: projectId,
        event_type: 'validation_started',
        data: {
          trigger: 'push_handler',
          repository: parsed.repository.fullName,
          ref: payload.ref,
          commits: parsed.commits?.length || 0,
        },
      });

      actions.push('Triggered spec validation');
    }

    // Example: Send notification for main branch pushes
    if (payload.ref === `refs/heads/${parsed.repository.defaultBranch}`) {
      const slackWebhook = context.config.secrets.SLACK_WEBHOOK;
      if (slackWebhook) {
        await services.notifications.sendSlack(slackWebhook, {
          text: `📝 New commits pushed to ${parsed.repository.fullName}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${parsed.commits?.length || 0} new commits* in <${parsed.repository.url}|${parsed.repository.fullName}>`,
              },
            },
            {
              type: 'section',
              fields:
                parsed.commits?.slice(0, 3).map(commit => ({
                  type: 'mrkdwn',
                  text: `• ${commit.message}\n  _by ${commit.author}_`,
                })) || [],
            },
          ],
        });
        actions.push('Sent Slack notification');
      }
    }

    // Example: Auto-create issues for breaking changes
    if (parsed.commits?.some(commit => commit.message.toLowerCase().includes('breaking'))) {
      // This would integrate with the repository's issue tracker
      logger.info('Breaking changes detected, consider creating tracking issue');
      actions.push('Detected breaking changes');
    }

    return {
      success: true,
      message: `Processed ${parsed.commits?.length || 0} commits`,
      actions,
      data: {
        repository: parsed.repository.fullName,
        ref: payload.ref,
        commitsProcessed: parsed.commits?.length || 0,
        specFilesChanged: specChanges,
      },
    };
  } catch (error) {
    logger.error('Push handler failed', error as Error);

    return {
      success: false,
      message: 'Push handler execution failed',
      errors: [
        {
          code: 'HANDLER_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      ],
    };
  }
};

// Handler module export
const handlerModule: HandlerModule = {
  handler: handlePush,
  config: {
    enabled: true,
    timeout: 30000, // 30 seconds
    retries: 2,
    environment: {},
    secrets: {},
  },
  metadata: {
    name: 'Push Event Handler',
    description: 'Handles Git push events with spec validation and notifications',
    version: '1.0.0',
    author: 'Arbiter Team',
    supportedEvents: ['push', 'Push Hook'],
    requiredPermissions: ['events:publish', 'notifications:send'],
  },
};

export default handlerModule;
