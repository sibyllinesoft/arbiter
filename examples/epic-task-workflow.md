# Epic and Task Management Workflow

This example demonstrates how to use Arbiter's epic and task management features
with dependency-driven execution and sharded CUE storage.

## Overview

- **Epics**: Major features or initiatives containing related tasks
- **Tasks**: Individual work items with dependencies within epics
- **Sharded Storage**: CUE files are split across multiple shards for better
  organization
- **Dependency Execution**: Tasks progress based on dependency relationships
  rather than manual ordering

## Basic Workflow

### 1. Create a New Epic

```bash
# Create an epic for adding epic/task management to Arbiter
arbiter epic create \
  --name "Add Epic and Task Management" \
  --description "Implement comprehensive epic and task management with dependency-driven execution" \
  --priority high \
  --owner architect \
  --assignee backend-team \
  --start-date 2024-01-15 \
  --due-date 2024-02-15 \
  --labels "feature,infrastructure" \
  --tags "v2.0,epic-management" \
  --allow-parallel-tasks
```

### 2. Add Individual Tasks

```bash
# Add first task - schema design
arbiter task create \
  --epic add-epic-and-task-management \
  --name "Design Epic and Task Schema" \
  --description "Create comprehensive CUE schemas for epic and task management" \
  --type feature \
  --priority high \
  --assignee architect \
  --acceptance-criteria "CUE schema validates epic structure,Dependencies are properly modeled,Schema supports dependency validation"

# Add second task - depends on first
arbiter task create \
  --epic add-epic-and-task-management \
  --name "Implement Sharded Storage" \
  --description "Create sharded CUE file storage architecture" \
  --type feature \
  --priority high \
  --assignee backend-dev \
  --depends-on "design-epic-and-task-schema" \
  --acceptance-criteria "Files are sharded based on configurable limits,Manifest tracks shard contents"
```

### 3. Batch Create Tasks from JSON

```bash
# Use the sample tasks file to create multiple tasks at once
arbiter task batch --epic add-epic-and-task-management --file examples/sample-tasks.json --verbose
```

### 4. View Epic Progress

```bash
# Show detailed epic information with all tasks
arbiter epic show add-epic-and-task-management

# List all epics with progress summary
arbiter epic list --format table

# Filter epics by status
arbiter epic list --status in_progress
```

### 5. Manage Task Progress

```bash
# List all tasks across epics (dependency-aware ordering)
arbiter task list --format table

# View detailed task information
arbiter task show design-epic-and-task-schema

# Update task status as work progresses
arbiter task update design-epic-and-task-schema --status in_progress
arbiter task update design-epic-and-task-schema --status completed

# Mark task as complete (shorthand)
arbiter task complete implement-sharded-storage
```

### 6. Filter and Query Tasks

```bash
# Show only tasks assigned to specific person
arbiter task list --assignee backend-dev

# Show only feature tasks
arbiter task list --type feature

# Show high priority tasks
arbiter task list --priority high

# Show completed tasks
arbiter task list --status completed
```

### 7. Update Epic Status

```bash
# Update epic as work progresses
arbiter epic update add-epic-and-task-management --status in_progress

# Change epic priority
arbiter epic update add-epic-and-task-management --priority critical

# Reassign epic
arbiter epic update add-epic-and-task-management --assignee senior-dev
```

### 8. View Storage Statistics

```bash
# See sharded storage utilization
arbiter epic stats

# JSON output for programmatic use
arbiter epic stats --format json
```

## JSON Schema for Batch Task Creation

When using `arbiter task batch`, provide a JSON array of task objects:

```json
[
  {
    "name": "Task Name",
    "description": "Task description",
    "type": "feature|bug|refactor|test|docs|devops|research",
    "priority": "critical|high|medium|low",
    "assignee": "developer-name",
    "reviewer": "reviewer-name",
    "dependsOn": ["other-task-id"],
    "acceptanceCriteria": ["Criteria 1", "Criteria 2"],
    "canRunInParallel": false,
    "requiresReview": true,
    "requiresTesting": true,
    "blocksOtherTasks": false
  }
]
```

## File Structure

The epic and task management creates the following file structure:

```
.arbiter/
├── epics/                          # Sharded epic storage
│   ├── epic-shard-1.cue           # First shard of epics
│   ├── epic-shard-2.cue           # Second shard of epics
│   └── ...
├── shard-manifest.cue              # Manifest tracking all shards
└── schemas/
    └── epic-task.cue               # Epic and task CUE schemas
```

## Task Dependencies

Tasks within an epic progress based on their `dependsOn` relationships, which
reference other task IDs within the same epic. Arbiter validates that dependency
graphs are acyclic and enforces dependency completion before tasks can proceed.

### Dependency Rules:

- Tasks cannot start until their dependencies are completed
- Circular dependencies are validated and rejected
- Tasks marked with `canRunInParallel: true` can execute alongside others once
  prerequisites finish

### Epic Configuration:

- `allowParallelTasks`: Allow multiple tasks to run simultaneously
- `autoProgress`: Automatically move to next task when current completes
- `requireAllTasks`: Epic only completes when all tasks are done

## Integration with Arbiter CUE Generation

Tasks can include `arbiter` configuration to integrate with other Arbiter
commands:

```json
{
  "name": "Add Authentication Service",
  "arbiter": {
    "cueManipulation": {
      "operation": "add_service",
      "target": "auth-service",
      "parameters": {
        "language": "typescript",
        "port": 3001
      }
    },
    "generatedCode": {
      "language": "typescript",
      "outputPath": "./src/auth",
      "template": "service-auth"
    },
    "testing": {
      "testTypes": ["unit", "integration"],
      "coverage": 90
    }
  }
}
```

This enables tasks to automatically trigger Arbiter's code generation and CUE
manipulation when they are marked as completed.

## Best Practices

1. **Start with Epic Planning**: Define clear epic goals and acceptance criteria
2. **Break Down Work**: Create 5-10 tasks per epic for manageable chunks
3. **Use Dependencies**: Model task dependencies to ensure correct execution
   order
4. **Batch Creation**: Use JSON files for complex epics with many tasks
5. **Regular Updates**: Keep task status current to track progress accurately
6. **Meaningful Names**: Use descriptive epic and task names that generate good
   slugs
7. **Acceptance Criteria**: Define clear, testable criteria for each task
8. **Shard Management**: Let the system auto-create shards based on epic count

## Advanced Usage

### Custom CUE Schemas

You can extend the base epic/task schemas by creating custom CUE files that
import the base schemas:

```cue
package myproject

import "github.com/arbiter/schemas:epic-task"

// Extend Epic with custom fields
#MyEpic: epic-task.#Epic & {
  // Add custom fields
  customField?: string
  projectSpecific?: {
    budget?: number
    stakeholders?: [...string]
  }
}
```

### Programmatic Access

All commands support JSON output for integration with other tools:

```bash
# Get epic data as JSON
EPIC_DATA=$(arbiter epic show my-epic --format json)

# Get task list as JSON for processing
TASKS=$(arbiter task list --status todo --format json)

# Process with jq
echo "$TASKS" | jq '.[] | select(.priority == "high")'
```

This enables building custom dashboards, reporting tools, and integration with
project management systems.
