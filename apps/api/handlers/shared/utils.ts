/**
 * Shared utilities for webhook handlers
 */

export function formatSlackMessage(title: string, details: Record<string, unknown>) {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${title}*`,
        },
      },
      {
        type: 'section',
        fields: Object.entries(details).map(([key, value]) => ({
          type: 'mrkdwn',
          text: `*${key}:* ${value}`,
        })),
      },
    ],
  };
}

export function extractSpecFiles(filePaths: string[]): string[] {
  return filePaths.filter(path => path.endsWith('.cue') || path.endsWith('.spec.ts'));
}

export function shouldNotify(branch: string, defaultBranch: string): boolean {
  return branch === `refs/heads/${defaultBranch}` || branch.includes('release');
}
