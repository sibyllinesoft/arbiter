/**
 * GitHub Push Event Handler
 * Processes push events from GitHub webhooks and runs importer for persistence
 */

const path = require('path');

// Handler function that processes push events
async function handlePushEvent(payload, context) {
  const { logger } = context;
  const { parsed } = payload;

  // Extract key information from the push event
  const repository = parsed.repository?.full_name || 'unknown';
  const branch = parsed.ref?.replace('refs/heads/', '') || 'unknown';
  const pusher = parsed.pusher?.name || parsed.sender?.login || 'unknown';
  const commits = parsed.commits || [];
  const commitCount = commits.length;

  // Colorful logging to stdout
  console.log('\x1b[32m%s\x1b[0m', '🚀 GitHub Push Hook Received!');
  console.log('\x1b[36m%s\x1b[0m', `📂 Repository: ${repository}`);
  console.log('\x1b[33m%s\x1b[0m', `🌿 Branch: ${branch}`);
  console.log('\x1b[35m%s\x1b[0m', `👤 Pusher: ${pusher}`);
  console.log('\x1b[34m%s\x1b[0m', `📊 Commits: ${commitCount}`);

  if (commitCount > 0) {
    console.log('\x1b[37m%s\x1b[0m', '📝 Recent Commits:');
    commits.slice(0, 3).forEach(commit => {
      // Log first 3
      console.log(
        `  - ${commit.id?.substring(0, 7)}: ${commit.message?.split('\n')[0] || 'No message'}`
      );
    });
  }

  logger.info('GitHub push event processed', { repository, branch, pusher, commitCount });

  return {
    success: true,
    message: `GitHub push hook processed for ${repository}:${branch}`,
    data: { repository, branch, pusher, commitCount },
  };
}

// Export the handler module
module.exports = {
  handler: handlePushEvent,
  config: {
    enabled: true,
    events: ['push'],
    timeout: 30000,
    retries: 2,
    filters: {
      branches: ['main', 'master'],
    },
  },
  metadata: {
    id: 'github-push-handler',
    name: 'GitHub Push Handler with Importer',
    description: 'Processes GitHub push events and runs importer for persistence',
    version: '1.1.0',
    author: 'Arbiter',
    tags: ['github', 'push', 'importer', 'persistence'],
  },
};
