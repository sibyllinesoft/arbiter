# GitHub Synchronization

The Arbiter CLI now supports synchronizing epics and tasks to GitHub issues and
milestones. This feature enables you to keep your project management in sync
between Arbiter and GitHub.

## Configuration

Add GitHub sync configuration to your `.arbiter/config.json`:

```json
{
  "github": {
    "repository": {
      "owner": "your-org",
      "repo": "your-repo",
      "token": "your-github-token",
      "tokenEnv": "GITHUB_TOKEN"
    },
    "mapping": {
      "epicPrefix": "[Epic]",
      "taskPrefix": "[Task]",
      "defaultLabels": ["arbiter-generated"],
      "epicLabels": {
        "high": ["priority-high"],
        "critical": ["priority-critical"]
      },
      "taskLabels": {
        "feature": ["type-feature"],
        "bug": ["type-bug"]
      }
    },
    "behavior": {
      "createMilestones": true,
      "autoClose": true,
      "syncAcceptanceCriteria": true,
      "syncAssignees": false
    }
  }
}
```

## Usage

### Sync After Generation

Sync epics and tasks to GitHub after generating project files:

```bash
arbiter generate --sync-github
```

### Preview Sync Changes

See what would be synced without making changes:

```bash
arbiter generate --github-dry-run
```

### Combined with Dry Run

Preview both file generation and GitHub sync:

```bash
arbiter generate --dry-run --sync-github
```

## Configuration Options

### Repository

- `owner`: GitHub repository owner/organization
- `repo`: GitHub repository name
- `token`: GitHub personal access token (can also use `GITHUB_TOKEN` environment
  variable)
- `tokenEnv`: Environment variable name for GitHub token (defaults to
  `GITHUB_TOKEN`). Allows customization for different deployment environments.
- `baseUrl`: Custom GitHub API URL (defaults to github.com)

### Mapping

- `epicPrefix`: Prefix for epic issues (default: "[Epic]")
- `taskPrefix`: Prefix for task issues (default: "[Task]")
- `defaultLabels`: Labels applied to all synced issues
- `epicLabels`: Mapping of epic priorities to GitHub labels
- `taskLabels`: Mapping of task types to GitHub labels

### Behavior

- `createMilestones`: Create GitHub milestones for epics (default: false)
- `autoClose`: Automatically close issues when epics/tasks are completed
  (default: false)
- `syncAcceptanceCriteria`: Include acceptance criteria in task descriptions
  (default: false)
- `syncAssignees`: Sync assignees between systems (default: false)

## Authentication

The GitHub sync feature requires a GitHub personal access token with the
following permissions:

- `repo` scope (for private repositories)
- `public_repo` scope (for public repositories)
- `issues:write` permission

You can provide the token in three ways:

1. In the configuration file: `"token": "your-github-token"`
2. As an environment variable: `GITHUB_TOKEN=your-github-token`
3. As a custom environment variable: Set `"tokenEnv": "CUSTOM_TOKEN_NAME"` in
   config and use `CUSTOM_TOKEN_NAME=your-github-token`

The tokenEnv option is useful for different deployment environments where you
might need to use different environment variable names.

## Idempotent Operations

The GitHub sync is designed to be idempotent:

- Existing issues are updated only when content changes
- Issues are tracked by Arbiter ID embedded in the issue body
- Running sync multiple times produces the same result
- No duplicate issues are created

## Issue Mapping

### Epics → GitHub Issues

- **Title**: `[Epic] Epic Name`
- **Body**: Epic description with metadata (status, priority, owner, etc.)
- **Labels**: Based on priority and custom epic label mappings
- **Milestone**: Created if `createMilestones` is enabled
- **Assignee**: Synced if `syncAssignees` is enabled

### Tasks → GitHub Issues

- **Title**: `[Task] Task Name`
- **Body**: Task description with epic context and acceptance criteria
- **Epic Mapping**: `epicId` links each task back to its parent epic for
  GitHub/GitLab sync
- **Labels**: Based on type and custom task label mappings
- **Milestone**: Linked to epic milestone if available
- **Assignee**: Synced if `syncAssignees` is enabled

### Epics → GitHub Milestones

When `createMilestones` is enabled:

- **Title**: `Epic: Epic Name`
- **Description**: Epic details with task count and estimated hours
- **Due Date**: From epic due date if set

## Example Workflow

1. Create epics and tasks in Arbiter:

   ```bash
   arbiter epic create "User Authentication"
   arbiter epic task add "User Authentication" "Create login form" --type feature
   arbiter epic task add "User Authentication" "Add password validation" --type feature
   ```

2. Preview what would be synced:

   ```bash
   arbiter generate --github-dry-run
   ```

3. Generate files and sync to GitHub:

   ```bash
   arbiter generate --sync-github
   ```

4. Check your GitHub repository for the new issues and milestone.

## Troubleshooting

### Common Issues

1. **No GitHub configuration found**
   - Add the `github` section to your `.arbiter/config.json`
   - Ensure the file is in the correct location

2. **Authentication failed**
   - Verify your GitHub token has the correct permissions
   - Check that the token hasn't expired
   - Ensure the repository owner/name is correct

3. **No epics found to sync**
   - Create epics using `arbiter epic create <name>`
   - Ensure epics are stored in `.arbiter/epics/` directory

4. **API rate limit exceeded**
   - GitHub has rate limits for API requests
   - Use `--github-dry-run` to preview changes without making API calls
   - Consider using a GitHub App token for higher rate limits

### Debug Mode

Use `--verbose` flag for detailed sync information:

```bash
arbiter generate --sync-github --verbose
```

This will show:

- Number of epics and tasks loaded
- Detailed sync results for each item
- Full error messages if sync fails
