# GitHub Synchronization

The Arbiter CLI can synchronize epics and tasks to GitHub issues (and optional milestones). This page reflects the simplified config shape—`prefixes`, `labels`, and `automation`—used by `GitHubSyncConfig`.

## Configuration

Add a `github` block to `.arbiter/config.json`:

```json
{
  "github": {
    "repository": {
      "owner": "your-org",
      "repo": "your-repo",
      "tokenEnv": "GITHUB_TOKEN"
    },
    "prefixes": {
      "epic": "[Epic]",
      "task": "[Task]"
    },
    "labels": {
      "default": ["arbiter-generated"],
      "epics": {
        "critical": ["priority:critical"],
        "high": ["priority:high"]
      },
      "tasks": {
        "bug": ["type:bug"],
        "feature": ["type:feature"]
      }
    },
    "automation": {
      "createMilestones": true,
      "autoClose": true,
      "syncAcceptanceCriteria": true,
      "syncAssignees": false
    }
  }
}
```

## Configuration Options

### Repository
- `owner` / `repo`: GitHub repository coordinates.
- `tokenEnv`: Environment variable name for the token (defaults to `GITHUB_TOKEN`).
- `baseUrl`: Custom GitHub API URL (GitHub Enterprise).

### Prefixes
- `epic`: Title prefix for epic issues (e.g., `[Epic]`).
- `task`: Title prefix for task issues (e.g., `[Task]`).

### Labels
- `default`: Labels applied to every synced issue.
- `epics`: Priority → labels map (`"critical": ["priority:critical"]`).
- `tasks`: Type → labels map (`"bug": ["type:bug"]`).

### Automation
- `createMilestones`: Create/maintain milestones from epics.
- `autoClose`: Close GitHub issues when epics/tasks complete.
- `syncAcceptanceCriteria`: Include acceptance criteria in task bodies.
- `syncAssignees`: Mirror assignees to GitHub.

## Usage

### Sync After Generation
```bash
arbiter generate --sync-github
```

### Preview Sync Changes
```bash
arbiter generate --github-dry-run
```

### Combined with Dry Run
```bash
arbiter generate --dry-run --sync-github
```

## Authentication

Use a personal access token with `repo` scope (or `public_repo` for public repos). Provide it via:
1. Environment variable (recommended): `GITHUB_TOKEN=...`
2. Custom env var: set `tokenEnv` and export that variable

## Idempotent Operations
- Issues are keyed by an embedded `arbiter-id` comment to avoid duplicates.
- Updates only occur when content changes.
- Re-running sync produces the same result.

## Title & Label Logic (conceptual)
- Titles use `prefixes.epic` / `prefixes.task` plus the epic/task name.
- Labels combine `labels.default`, mapped priority/type labels, status/priority tags, and any labels already present on the epic/task in Arbiter.

## Troubleshooting
- **Missing config**: ensure `.arbiter/config.json` contains a `github` block.
- **Auth failures**: verify the token and scopes; check `tokenEnv` name.
- **Rate limits**: use `--github-dry-run` for previews; GitHub App tokens can raise limits.
- **Verbose output**: add `--verbose` to see every API call and decision.
