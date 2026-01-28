package test

// Standalone test for issue schema definitions

// Core type definitions (copied for standalone testing)
#Slug:          =~"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
#Human:         string & !=""
#ISODateTime:   =~"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"
#URL:           =~"^https?://[^\\s]+$"

// Entity types that can be referenced by issues
#EntityType: "package" | "resource" | "group" |
             "endpoint" | "view" |
             "capability" | "operation" | "behavior" | "issue" | "actor" | "relationship"

// Structured reference to another entity
#EntityRef: {
    type:   #EntityType
    slug:   #Slug
    label?: #Human
}

// Issue workflow states (aligned with TypeScript)
#IssueStatus: "open" | "in_progress" | "blocked" | "review" | "done" | "closed" | "wontfix"

// Issue priority levels
#IssuePriority: "critical" | "high" | "medium" | "low"

// Issue type
#IssueType: "issue" | "bug" | "feature" | "task" | "epic" | "milestone" | "story" | "spike"

// External source
#ExternalSource: "local" | "github" | "gitlab" | "jira" | "linear"

// Issue configuration
#IssueConfig: {
    title:        #Human
    description?: string
    type?:        #IssueType | *"issue"
    status:       #IssueStatus | *"open"
    priority?:    #IssuePriority
    references?:  [...#EntityRef]
    assignees?:   [...#Human]
    labels?:      [...#Slug]
    due?:         #ISODateTime
    created?:     #ISODateTime
    updated?:     #ISODateTime
    closedAt?:    #ISODateTime
    parent?:      #Slug
    milestone?:   #Slug
    related?:     [...{
        issue: #Slug
        type:  "blocks" | "blocked-by" | "duplicates" | "related-to"
    }]
    memberOf?:    #Slug
    weight?:      int & >=0
    estimate?:    number & >=0
    timeSpent?:   number & >=0
    source?:      #ExternalSource | *"local"
    externalId?:  string
    externalUrl?: #URL
    externalRepo?: string
}

// Test cases

// Valid: Basic issue with defaults
test_basic: #IssueConfig & {
    title: "Fix login bug"
}

// Valid: Full issue with all fields
test_full: #IssueConfig & {
    title:       "Implement user authentication"
    description: "Add OAuth2 authentication flow"
    type:        "feature"
    status:      "in_progress"
    priority:    "high"
    assignees:   ["Backend Team"]
    labels:      ["security", "feature"]
    references: [
        {type: "package", slug: "auth-service"},
        {type: "package", slug: "shared-types"},
    ]
    related: [
        {issue: "add-oauth-provider", type: "blocks"},
    ]
}

// Valid: Issue referencing multiple entity types
test_multi_refs: #IssueConfig & {
    title: "Security audit"
    status: "open"
    priority: "critical"
    references: [
        {type: "package", slug: "api-gateway"},
        {type: "package", slug: "auth-service"},
        {type: "package", slug: "web-app"},
        {type: "group", slug: "core-services"},
    ]
}

// Valid: Issue with hierarchical tracking
test_hierarchy: #IssueConfig & {
    title: "Subtask for main group"
    status: "open"
    parent: "main-issue"
    memberOf: "q1-planning"
}

// Valid: Issue from external source
test_external: #IssueConfig & {
    title: "Bug from GitHub"
    type: "bug"
    status: "open"
    source: "github"
    externalId: "123"
    externalUrl: "https://github.com/org/repo/issues/123"
    externalRepo: "org/repo"
}
