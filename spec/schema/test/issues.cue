package test

// Standalone test for issue schema definitions

// Core type definitions (copied for standalone testing)
#Slug:          =~"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
#Human:         string & !=""
#ISODateTime:   =~"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"

// Entity types that can be referenced by issues
#EntityType: "service" | "client" | "package" | "tool" | "group" |
             "capability" | "operation" | "behavior" | "issue"

// Structured reference to another entity
#EntityRef: {
    type:   #EntityType
    slug:   #Slug
    label?: #Human
}

// Issue workflow states
#IssueStatus: "open" | "in-progress" | "resolved" | "closed" | "wont-fix"

// Issue priority levels
#IssuePriority: "critical" | "high" | "medium" | "low"

// Issue configuration
#IssueConfig: {
    title:        #Human
    description?: string
    status:       #IssueStatus | *"open"
    priority?:    #IssuePriority
    references?:  [...#EntityRef]
    assignee?:    #Human
    labels?:      [...#Slug]
    due?:         #ISODateTime
    created?:     #ISODateTime
    updated?:     #ISODateTime
    parent?:      #Slug
    related?:     [...{
        issue: #Slug
        type:  "blocks" | "blocked-by" | "duplicates" | "related-to"
    }]
    memberOf?:    #Slug
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
    status:      "in-progress"
    priority:    "high"
    assignee:    "Backend Team"
    labels:      ["security", "feature"]
    references: [
        {type: "service", slug: "auth-service"},
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
        {type: "service", slug: "api-gateway"},
        {type: "service", slug: "auth-service"},
        {type: "client", slug: "web-app"},
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
