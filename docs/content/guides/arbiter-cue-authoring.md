# Arbiter CUE Authoring Guide

Use this guide when writing or reviewing Arbiter specs. For every field and type, refer to the [schema reference](../reference/arbiter-cue-schema.md); this page keeps the “how to author” guidance separate from the type dump.

## Quick authoring checklist
1. Define `meta` (name, version, repository) early; language/framework now lives with each service or client.
2. Model domain types using **schemas** with types (Entity, Value, Request, Response, Event) and **processes** before wiring services.
3. Define schema fields, validation rules, and relationships using **CUE syntax** for type-safe, expressive definitions.
4. Add contracts under `contracts.workflows` with **SLA/Performance requirements** upfront, and define operations/schemas using **CUE syntax**.
5. Declare services in `services.<name>` with `language`, `serviceType`/`workload`, and grouped dependencies (`dependencies.services`, `dependencies.databases`, etc.).
6. Use `environments.<environment>` for execution settings; the legacy singular `deployment` key is no longer supported.
7. Lock determinism by pinning generators/templates in your build pipeline (no root `codegen` key required).

## Working with Schemas

Arbiter uses a unified **Schema** concept with five types:
- **Entity**: Business objects with identity (e.g., Invoice, Customer)
- **Value**: Immutable data structures (e.g., Address, Money)
- **Request**: API request payloads
- **Response**: API response payloads
- **Event**: Domain events representing state changes

**Using the CLI/UI:**
- Add schemas with `arbiter add schema` and select the appropriate type
- Define fields, validation rules, and relationships using **CUE syntax**
- All schema fields support CUE's expressive type system for validation

**CUE Syntax Examples:**
```cue
// Fields definition
amount: number
currency: "USD" | "EUR" | "GBP"
customer_id: string
metadata?: {...}

// Validation rules (constraints)
amount > 0
currency: "USD" | "EUR" | "GBP"
customer_id: =~"^[0-9a-f]{8}-[0-9a-f]{4}-"

// Relationships
customer: #Customer
items: [...#LineItem]
```

## Working with Contracts

Contracts define how systems communicate. When defining contracts:

1. **Specify SLA/Performance requirements early** for visibility (e.g., "p95 < 200ms, uptime 99.9%")
2. **Version contracts** for compatibility tracking
3. **Define operations using CUE syntax** for type-safe operation definitions
4. **Use CUE for request/response schemas** to ensure consistency

**Field Order:**
1. Name
2. SLA/Performance
3. Version
4. Operations (CUE syntax)
5. Request Schema (CUE syntax)
6. Response Schema (CUE syntax)
7. Description (markdown)

## Working with Issues and Comments

Arbiter supports tracking work items (issues) and comments attached to any entity. The issue schema is designed for compatibility with GitHub, GitLab, and Jira.

### Issues

Use `issues` to track epics, bugs, tasks, and other work items that reference spec entities:

```cue
issues: {
  "add-invoice-export": {
    entityId:   "550e8400-e29b-41d4-a716-446655440001"
    title:      "Add invoice export functionality"
    type:       "feature"                   // "issue" | "bug" | "feature" | "task" | "epic" | "story" | "spike"
    status:     "in_progress"
    priority:   "high"
    references: [{type: "service", id: "invoiceService"}]
    assignees:  ["alice", "bob"]            // Multiple assignees (GitHub/GitLab compatible)
    labels:     ["feature", "billing"]
    milestone:  "v2-release"                // Reference to a group representing the milestone
    weight:     5                           // Story points (GitLab weight, Jira points)
    estimate:   8                           // Time estimate in hours
  }
}
```

### Milestones and Epics are Groups

Milestones (GitHub), epics (GitLab/Jira), releases, and sprints are all represented as groups with a `type` field for sync identification:

```cue
groups: {
  "v2-release": {
    entityId:    "550e8400-e29b-41d4-a716-446655440010"
    name:        "v2.0 Release"
    description: "Q2 2024 major release milestone"
    type:        "milestone"                // "group" | "milestone" | "epic" | "release" | "sprint" | "iteration"
    due:         "2024-06-30T00:00:00Z"
    status:      "open"                     // "open" | "closed" | "active"

    // Track external source if imported from GitHub/GitLab
    source:      "github"
    externalId:  "5"
    externalUrl: "https://github.com/org/repo/milestone/5"
  }

  "user-auth-epic": {
    entityId:    "550e8400-e29b-41d4-a716-446655440011"
    name:        "User Authentication"
    type:        "epic"
    memberOf:    "v2-release"               // Epic belongs to the milestone
    source:      "gitlab"
    externalId:  "42"
  }
}
```

Issues connect to groups via `memberOf`. The `milestone` field identifies which group is THE milestone for idempotent sync:

```cue
issues: {
  "auth-feature": {
    title:     "Implement OAuth"
    memberOf:  "user-auth-epic"             // Primary group membership
    milestone: "v2-release"                 // Which group is the milestone (for sync)
    // ...
  }
}
```

**Key points:**
- `memberOf`: Primary connection to any group (epic, sprint, feature group, etc.)
- `milestone`: Specifically identifies the milestone group for GitHub/GitLab sync
- `type` on groups: Tells sync what kind of external entity to create/update

### Comments

Comments are a versatile entity type that serves multiple purposes:

1. **Human discussions**: Notes, feedback, and commentary on issues/epics/entities
2. **Agent guidance**: Additional context beyond `description` fields to guide AI code generation
3. **Knowledge graph**: Memory storage for AI agents to persist context and decisions across sessions

```cue
comments: {
  "invoice-export-impl-guidance": {
    entityId:   "550e8400-e29b-41d4-a716-446655440002"
    content:    "When implementing export, use streaming for large datasets. Consider chunked responses for files >10MB."
    target:     "add-invoice-export"          // Target entity UUID or slug
    targetType: "issue"
    kind:       "guidance"                    // "discussion" | "guidance" | "memory" | "decision" | "note"
    author:     "Alice"
    tags:       ["implementation", "performance"]
  }

  "customer-pattern-memory": {
    entityId:   "550e8400-e29b-41d4-a716-446655440003"
    content:    "User prefers repository pattern for data access. Previous discussion concluded to use dependency injection."
    target:     "invoiceService"
    targetType: "service"
    kind:       "memory"                      // Agent knowledge persistence
    tags:       ["patterns", "architecture"]
  }
}
```

**Comment kinds:**
- `discussion`: General discussion and feedback (default)
- `guidance`: Instructions for code generation or implementation
- `memory`: Agent-persisted context and decisions (knowledge graph)
- `decision`: Architectural or design decisions with rationale
- `note`: General notes and documentation

Comments with `kind: "guidance"` are surfaced to AI agents during code generation alongside the entity's description field, providing additional context for implementation.

## Compatibility notes
- **`deployment` vs `environments`:** Use `environments.<env>` only; the singular `deployment` key has been removed.
- **Schema evolution:** Breaking changes should bump `meta.version` and add compatibility details under `contracts.compat`.
- **Overrides:** Keep per-service hints minimal to reduce drift between environments.
- **Schema types:** Use the unified Schema concept with type selection rather than treating entities/valueObjects as completely separate domain concepts.

## Validation & tooling
- Validate locally with `arbiter validate <file.cue>` before running `arbiter generate`.
- The template context generator (`packages/cli/src/templates/index.ts`) serializes your spec directly; inspect that JSON (see Template Development Guide) if a template misunderstands your data.

## Reference
The full type list (e.g., `#Service`, `#Deployment`, `#Runtime`) lives in the [schema reference](../reference/arbiter-cue-schema.md). Regenerate docs via `bun run docs:cue` when the schema changes.
