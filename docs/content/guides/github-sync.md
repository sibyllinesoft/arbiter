# GitHub Synchronization

The Arbiter CLI can synchronize groups and tasks to GitHub issues (and optional milestones). This page reflects the simplified config shape—`prefixes`, `labels`, and `automation`—used by `GitHubSyncConfig`.

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
      "group": "[Group]",
      "task": "[Task]"
    },
    "labels": {
      "default": ["arbiter-generated"],
      "groups": {
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
- `group`: Title prefix for group issues (e.g., `[Group]`).
- `task`: Title prefix for task issues (e.g., `[Task]`).

### Labels
- `default`: Labels applied to every synced issue.
- `groups`: Priority → labels map (`"critical": ["priority:critical"]`).
- `tasks`: Type → labels map (`"bug": ["type:bug"]`).

### Automation
- `createMilestones`: Create/maintain milestones from groups.
- `autoClose`: Close GitHub issues when groups/tasks complete.
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
- Titles use `prefixes.group` / `prefixes.task` plus the group/task name.
- Labels combine `labels.default`, mapped priority/type labels, status/priority tags, and any labels already present on the group/task in Arbiter.

## Issue Schema Compatibility

Arbiter's issue schema is designed for compatibility with GitHub, GitLab, and Jira. When syncing from external systems, the following fields track the source:

```cue
issues: {
  "feature-auth": {
    entityId:     "550e8400-e29b-41d4-a716-446655440001"
    title:        "Implement OAuth authentication"
    type:         "feature"
    status:       "in_progress"
    assignees:    ["alice", "bob"]    // Multiple assignees (GitHub/GitLab)
    labels:       ["auth", "security"]
    milestone:    "v2.0"              // Links to a group representing the milestone
    weight:       5                   // Story points (GitLab weight, Jira points)

    // External source tracking
    source:       "github"            // "local" | "github" | "gitlab" | "jira" | "linear"
    externalId:   "42"                // GitHub issue number
    externalUrl:  "https://github.com/org/repo/issues/42"
    externalRepo: "org/repo"
  }
}
```

### Field Mapping

| Arbiter Field | GitHub | GitLab | Jira |
|---------------|--------|--------|------|
| `title` | title | title | summary |
| `description` | body | description | description |
| `type` | - (use labels) | - (use labels) | issuetype |
| `status` | state (open/closed) | state | status |
| `assignees` | assignees | assignees | assignee |
| `labels` | labels | labels | labels |
| `milestone` | milestone | milestone | fixVersion |
| `parent` | - (use projects) | epic | parent |
| `weight` | - | weight | story points |
| `due` | - (use projects) | due_date | duedate |
| `externalId` | number | iid | key |

### Milestones and Epics are Groups

GitHub milestones and GitLab epics are represented as Arbiter groups with a `type` field:

```cue
groups: {
  "v2-release": {
    entityId:    "550e8400-e29b-41d4-a716-446655440010"
    name:        "v2.0 Release"
    description: "Q2 2024 major release"
    type:        "milestone"           // "group" | "milestone" | "epic" | "release" | "sprint"

    // External source tracking
    source:      "github"
    externalId:  "5"                   // GitHub milestone number
    externalUrl: "https://github.com/org/repo/milestone/5"
  }

  "auth-epic": {
    entityId:    "550e8400-e29b-41d4-a716-446655440011"
    name:        "Authentication"
    type:        "epic"
    memberOf:    "v2-release"          // Epic belongs to milestone
    source:      "gitlab"
    externalId:  "42"
  }
}
```

Issues connect to groups via `memberOf`. The `milestone` field identifies THE milestone for sync:

```cue
issues: {
  "auth-feature": {
    title:     "Implement OAuth"
    memberOf:  "auth-epic"             // Primary group membership
    milestone: "v2-release"            // Which group is the milestone (for sync)
    source:    "github"
    externalId: "123"
  }
}
```

**Key points:**
- `type` on groups tells sync what external entity to create (milestone vs epic)
- `memberOf` is the primary connection from issues to groups
- `milestone` specifically identifies the milestone group for idempotent sync

### Bidirectional Sync Considerations

When importing issues from GitHub/GitLab:

1. **Source tracking**: Always set `source`, `externalId`, `externalUrl` to enable round-trip sync
2. **Entity IDs**: Generate stable UUIDs (`entityId`) for each imported issue
3. **Comments**: Import issue comments with their external IDs for thread continuity
4. **Labels**: Map external labels to Arbiter labels; consider prefixing imported labels

## Troubleshooting
- **Missing config**: ensure `.arbiter/config.json` contains a `github` block.
- **Auth failures**: verify the token and scopes; check `tokenEnv` name.
- **Rate limits**: use `--github-dry-run` for previews; GitHub App tokens can raise limits.
- **Verbose output**: add `--verbose` to see every API call and decision.
