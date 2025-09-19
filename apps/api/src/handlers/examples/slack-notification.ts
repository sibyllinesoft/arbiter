/**
 * Example: Slack notification handler
 * Sends formatted notifications to Slack channels on webhook events
 */

import type { HandlerModule, WebhookHandler } from '../types.js';

const handleSlackNotification: WebhookHandler = async (payload, context) => {
  const { logger, services, config } = context;
  const { parsed } = payload;

  logger.info('Processing Slack notification handler', {
    event: parsed.eventType,
    repository: parsed.repository.fullName,
  });

  const slackWebhook = config.secrets.SLACK_WEBHOOK;
  if (!slackWebhook) {
    return {
      success: false,
      message: 'SLACK_WEBHOOK secret not configured',
      errors: [
        {
          code: 'MISSING_CONFIGURATION',
          message: 'Slack webhook URL is required in handler configuration',
        },
      ],
    };
  }

  try {
    let message = '';
    let blocks: unknown[] = [];

    // Format message based on event type
    switch (parsed.eventType) {
      case 'push':
        if (parsed.commits && parsed.commits.length > 0) {
          message = `📝 ${parsed.commits.length} new commit(s) pushed to ${parsed.repository.fullName}`;

          blocks = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📝 New commits pushed',
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Repository:* <${parsed.repository.url}|${parsed.repository.fullName}>`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Commits:* ${parsed.commits.length}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Author:* ${parsed.author.name}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Branch:* ${payload.ref?.replace('refs/heads/', '') || 'unknown'}`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Recent commits:*',
              },
            },
          ];

          // Add up to 5 recent commits
          const recentCommits = parsed.commits.slice(0, 5);
          for (const commit of recentCommits) {
            blocks.push({
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `• <${commit.url}|${commit.sha.substring(0, 7)}> ${commit.message}\n  _by ${commit.author}_`,
              },
            });
          }

          if (parsed.commits.length > 5) {
            blocks.push({
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `_and ${parsed.commits.length - 5} more commits..._`,
                },
              ],
            });
          }
        }
        break;

      case 'pull_request':
        if (parsed.pullRequest && parsed.action) {
          const pr = parsed.pullRequest;
          const emoji =
            parsed.action === 'opened'
              ? '🔀'
              : parsed.action === 'closed' && pr.merged
                ? '✅'
                : parsed.action === 'closed'
                  ? '❌'
                  : '📝';

          message = `${emoji} Pull request ${parsed.action}: ${pr.title}`;

          blocks = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} Pull request ${parsed.action}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Repository:* <${parsed.repository.url}|${parsed.repository.fullName}>`,
                },
                {
                  type: 'mrkdwn',
                  text: `*PR:* <${pr.url}|#${pr.id}>`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Author:* ${parsed.author.name}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Branches:* ${pr.headBranch} → ${pr.baseBranch}`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${pr.title}*\n${pr.body ? pr.body.substring(0, 300) + (pr.body.length > 300 ? '...' : '') : '_No description provided_'}`,
              },
            },
          ];

          if (parsed.action === 'closed' && pr.merged) {
            blocks.push({
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '✅ This pull request was merged successfully',
                },
              ],
            });
          }
        }
        break;

      case 'issues':
        if (parsed.issue && parsed.action) {
          const issue = parsed.issue;
          const emoji =
            parsed.action === 'opened' ? '🐛' : parsed.action === 'closed' ? '✅' : '📝';

          message = `${emoji} Issue ${parsed.action}: ${issue.title}`;

          blocks = [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${emoji} Issue ${parsed.action}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Repository:* <${parsed.repository.url}|${parsed.repository.fullName}>`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Issue:* <${issue.url}|#${issue.id}>`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Author:* ${parsed.author.name}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Labels:* ${issue.labels.length > 0 ? issue.labels.join(', ') : 'None'}`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${issue.title}*\n${issue.body ? issue.body.substring(0, 300) + (issue.body.length > 300 ? '...' : '') : '_No description provided_'}`,
              },
            },
          ];
        }
        break;

      default:
        message = `🔔 ${parsed.eventType} event in ${parsed.repository.fullName}`;
        blocks = [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔔 Received *${parsed.eventType}* event from <${parsed.repository.url}|${parsed.repository.fullName}>`,
            },
          },
        ];
    }

    // Send Slack notification
    await services.notifications.sendSlack(slackWebhook, {
      text: message,
      blocks,
      username: 'Arbiter Webhook',
      iconEmoji: ':robot_face:',
    });

    logger.info('Slack notification sent successfully', {
      event: parsed.eventType,
      repository: parsed.repository.fullName,
    });

    return {
      success: true,
      message: 'Slack notification sent successfully',
      actions: ['Sent Slack notification'],
      data: {
        slackMessage: message,
        blocksCount: blocks.length,
      },
    };
  } catch (error) {
    logger.error('Slack notification failed', error as Error);

    return {
      success: false,
      message: 'Failed to send Slack notification',
      errors: [
        {
          code: 'NOTIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      ],
    };
  }
};

const handlerModule: HandlerModule = {
  handler: handleSlackNotification,
  config: {
    enabled: true,
    timeout: 15000,
    retries: 1,
    environment: {},
    secrets: {},
  },
  metadata: {
    name: 'Slack Notification Handler',
    description: 'Sends formatted notifications to Slack channels for webhook events',
    version: '1.0.0',
    author: 'Arbiter Team',
    supportedEvents: [
      'push',
      'pull_request',
      'merge_request',
      'issues',
      'Push Hook',
      'Merge Request Hook',
    ],
    requiredPermissions: ['notifications:send'],
  },
};

export default handlerModule;
