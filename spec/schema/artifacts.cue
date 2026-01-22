    package schema

    // ---------- Artifact Groups ----------

    // Group type - open-ended to support context-specific groupings
    // Common values: group, milestone, epic, release, sprint, iteration
    // Architecture: system, container, component, domain, layer, boundary
    #GroupType: #Slug

    // GroupSpec defines a logical grouping of artifacts.
    // Groups enable organization by feature, domain, or any other criteria.
    // Milestones (GitHub), epics (GitLab/Jira), and releases are represented as groups
    // with the appropriate `kind` field. Architecture levels (system, container, component)
    // also use `kind` for C4-style views.
    #GroupSpec: {
      #EntityMeta
      // Display name of the group
      name: #Human
      // Description of what this group contains
      description?: string
      // Group kind - identifies what this group represents
      // Sync: group, milestone, epic, release, sprint, iteration
      // Architecture: system, container, component, domain, layer, boundary
      kind?: #GroupType | *"group"
      // Override directory name (defaults to slugified name)
      directory?: #Slug
      // Tags for filtering/categorization
      tags?: [...#Slug]
      // Override project structure within this group
      structure?: #ProjectStructureConfig
      // Parent group (for nested groups)
      memberOf?: #Slug
      // Due date for milestone/release groups
      due?: #ISODateTime
      // Group status
      status?: "open" | "closed" | "active" | *"open"
      // Arbitrary context-specific metadata (e.g., C4 properties, custom attributes)
      metadata?: { [string]: _ }

      // ---------- External Source Tracking ----------
      // Where this group originated (local spec or external system)
      source?:      "local" | "github" | "gitlab" | "jira" | "linear" | *"local"
      // External system ID (e.g., GitHub milestone number, GitLab epic ID)
      externalId?:  string
      // Full URL to the group in the external system
      externalUrl?: #URL
      // Repository or project in the external system
      externalRepo?: string
    }

    // ---------- Relationships ----------

    // RelationshipSpec defines explicit connections between entities.
    // Complements implicit relationships derived from dependencies and handler refs.
    #RelationshipSpec: {
      #EntityMeta
      // Source entity slug (service, client, package, actor, group)
      from: #Slug
      // Target entity slug
      to: #Slug
      // Human-readable description of the relationship
      label?: string
      // Detailed description
      description?: string
      // Relationship semantics - open-ended to support various contexts
      // Common: uses, depends_on, calls, reads, writes, authenticates, notifies
      type?: #Slug | *"uses"
      // Technology or protocol (e.g., "HTTPS/JSON", "gRPC", "PostgreSQL", "AMQP")
      technology?: string
      // Whether the relationship is bidirectional
      bidirectional?: bool | *false
      // Tags for filtering/categorization
      tags?: [...#Slug]
    }

    // ProjectStructureConfig defines directory layout hints
    #ProjectStructureConfig: {
      clientsDirectory?:  string & !=""
      servicesDirectory?: string & !=""
      packagesDirectory?: string & !=""
      toolsDirectory?:    string & !=""
      docsDirectory?:     string & !=""
      testsDirectory?:    string & !=""
      infraDirectory?:    string & !=""
      packageRelative?: {
        docsDirectory?:  bool
        testsDirectory?: bool
        infraDirectory?: bool
      }
    }

    // ---------- Artifact Configurations ----------

    // Handler reference - points to code module or another service endpoint
    #HandlerReference: {
      // Module-based handler (local code)
      module?: string
      function?: string
    } | {
      // Endpoint-based handler (proxy to another service)
      service: #Slug
      endpoint: #Slug
    }

    // Middleware reference for request/response processing
    #MiddlewareReference: {
      name: #Slug
      phase?: "request" | "response" | *"request"
      config?: { [string]: _ }
    }

    // ServiceEndpointSpec defines an API endpoint within a service (component level)
    #ServiceEndpointSpec: {
      #EntityMeta
      // Human-readable description
      description?: string
      // URL path pattern (e.g., "/api/users/{id}")
      path: #URLPath
      // Supported HTTP methods
      methods: [...#HTTPMethod]
      // Handler implementation
      handler?: #HandlerReference
      // Operation contract this endpoint implements
      implements?: #Slug
      // Middleware chain
      middleware?: [...#MiddlewareReference]
      // Tags for filtering
      tags?: [...#Slug]
    }

    // ServiceConfig defines a backend service (container level)
    // Services are typed groups that can contain endpoints as components
    #ServiceConfig: {
      #EntityMeta
      name?:        #Human
      description?: string
      // C4/grouping type - defaults to "service", can be "container", "component", etc.
      kind?:        #GroupType | *"service"
      // Whether this is an external/third-party service
      external?:    bool | *false
      // Arbitrary metadata for context-specific properties
      metadata?:    { [string]: _ }

      // Implementation details
      language:     string & !=""
      template?:    string
      framework?:   string
      sourceDirectory?: string
      workload?:    "deployment" | "statefulset" | "daemonset" | "job" | "cronjob"
      image?:       string
      replicas?:    int & >0
      ports?: [...{
        name:       string
        port:       int & >0
        targetPort?: int & >0
        protocol?:  string
      }]
      env?:         { [string]: string }
      resources?: {
        requests?: { cpu?: string, memory?: string }
        limits?:   { cpu?: string, memory?: string }
      }
      healthCheck?: {
        path?:     #URLPath
        port?:     int & >0
        protocol?: string
        interval?: string
        timeout?:  string
      }

      // Component-level children (endpoints)
      endpoints?:   { [#Slug]: #ServiceEndpointSpec }

      tags?:        [...#Slug]
      // Parent group/system this service belongs to
      memberOf?:    #Slug
    }

    // ClientViewSpec defines a view/route within a client application (component level)
    #ClientViewSpec: {
      #EntityMeta
      // Human-readable description
      description?: string
      // Route path pattern (e.g., "/users/:id")
      path?: string
      // Route identifier (e.g., "users:detail")
      route?: #RouteID
      // Component/page that renders this view
      component?: string
      // Required capabilities/permissions
      requires?: [...#Cap]
      // Tags for filtering
      tags?: [...#Slug]
    }

    // ClientConfig defines a frontend application (container level)
    // Clients are typed groups that can contain views as components
    #ClientConfig: {
      #EntityMeta
      name?:        #Human
      description?: string
      // C4/grouping type - defaults to "client", can be "container", "component", etc.
      kind?:        #GroupType | *"client"
      // Arbitrary metadata for context-specific properties
      metadata?:    { [string]: _ }

      // Implementation details
      language:     string & !=""
      template?:    string
      framework?:   string
      sourceDirectory?: string
      port?:        int & >0
      env?:         { [string]: string }
      hooks?:       [...string]

      // Component-level children (views/routes)
      views?:       { [#Slug]: #ClientViewSpec }

      tags?:        [...#Slug]
      // Parent group/system this client belongs to
      memberOf?:    #Slug
    }

    // PackageConfig defines a reusable package/library (component level)
    #PackageConfig: {
      #EntityMeta
      name?:        #Human
      description?: string
      // C4/grouping type - defaults to "package", can be "component", "library", etc.
      kind?:        #GroupType | *"package"
      // Arbitrary metadata for context-specific properties
      metadata?:    { [string]: _ }

      language?:    string
      template?:    string
      sourceDirectory?: string
      tags?:        [...#Slug]
      // Parent group/container this package belongs to
      memberOf?:    #Slug
    }

    // ToolConfig defines developer tooling and automation
    #ToolConfig: {
      #EntityMeta
      name?:        #Human
      description?: string
      // C4/grouping type - defaults to "tool"
      kind?:        #GroupType | *"tool"
      // Arbitrary metadata for context-specific properties
      metadata?:    { [string]: _ }

      language?:    string
      template?:    string
      sourceDirectory?: string
      tags?:        [...#Slug]
      // Parent group this tool belongs to
      memberOf?:    #Slug
    }

    // Issue type for categorization (compatible with GitHub/GitLab/Jira)
    #IssueType: "issue" | "bug" | "feature" | "task" | "epic" | "milestone" | "story" | "spike"

    // IssueConfig defines a trackable work item that references spec entities
    #IssueConfig: {
      #EntityMeta
      // Issue title (required)
      title:        #Human
      // Detailed description of the issue
      description?: string
      // Issue type/category
      type?:        #IssueType | *"issue"
      // Current workflow status
      status:       #IssueStatus | *"open"
      // Priority level
      priority?:    #IssuePriority
      // References to other entities this issue relates to
      references?:  [...#EntityRef]
      // People or teams responsible (supports multiple assignees like GitHub/GitLab)
      assignees?:   [...#Human]
      // Labels for categorization (maps to GitHub labels, GitLab labels)
      labels?:      [...#Slug]
      // Due date in ISO format
      due?:         #ISODateTime
      // Creation timestamp
      created?:     #ISODateTime
      // Last update timestamp
      updated?:     #ISODateTime
      // Closed/completed timestamp
      closedAt?:    #ISODateTime
      // Parent issue for hierarchical tracking (epic/story relationship)
      parent?:      #Slug
      // Milestone this issue belongs to (maps to GitHub milestone, GitLab milestone)
      milestone?:   #Slug
      // Related issues (blocked-by, duplicates, etc.)
      related?:     [...{
        issue: #Slug
        type:  "blocks" | "blocked-by" | "duplicates" | "related-to"
      }]
      // Group this issue belongs to
      memberOf?:    #Slug

      // ---------- Estimation & Tracking ----------
      // Story points / weight (GitLab weight, Jira story points)
      weight?:      int & >=0
      // Time estimate in hours
      estimate?:    number & >=0
      // Time spent in hours
      timeSpent?:   number & >=0

      // ---------- External Source Tracking ----------
      // Where this issue originated (local spec or external system)
      source?:      "local" | "github" | "gitlab" | "jira" | "linear" | *"local"
      // External system issue ID (e.g., GitHub issue number, Jira key)
      externalId?:  string
      // Full URL to the issue in the external system
      externalUrl?: #URL
      // Repository or project in the external system (e.g., "owner/repo")
      externalRepo?: string
    }

    // CommentConfig defines a comment attached to entities in the spec.
    // Comments serve multiple purposes:
    // 1. Human discussions: Notes, feedback, and commentary on issues/epics/entities
    // 2. Agent guidance: Additional context beyond description fields to guide code generation
    // 3. Knowledge graph: Memory storage for AI agents to persist context and decisions
    #CommentConfig: {
      #EntityMeta
      // Comment content (markdown supported)
      content:      string & !=""
      // Entity this comment is attached to (entity UUID or slug)
      target:       string & !=""
      // Type of target entity (e.g., "issue", "service", "endpoint")
      targetType?:  string
      // Author of the comment
      author?:      #Human
      // Optional thread ID for grouping related comments
      threadId?:    #UUID
      // Parent comment ID for nested replies
      parentId?:    #UUID
      // Comment purpose/category
      kind?:        "discussion" | "guidance" | "memory" | "decision" | "note" | *"discussion"
      // Tags for filtering/categorization
      tags?:        [...#Slug]
      // Timestamp when comment was created
      created?:     #ISODateTime
      // Timestamp when comment was last edited
      edited?:      #ISODateTime
      // Whether this comment is resolved/archived
      resolved?:    bool | *false

      // ---------- External Source Tracking ----------
      // Where this comment originated (local spec or external system)
      source?:      "local" | "github" | "gitlab" | "jira" | "linear" | *"local"
      // External system comment ID
      externalId?:  string
      // Full URL to the comment in the external system
      externalUrl?: #URL
    }

    // ---------- Extended AppSpec with artifacts ----------

    // ArtifactsSpec extends the app specification with artifact definitions
    #ArtifactsSpec: {
      // Backend services
      services?: { [#Slug]: #ServiceConfig }
      // Frontend applications
      clients?: { [#Slug]: #ClientConfig }
      // Reusable packages/libraries
      packages?: { [#Slug]: #PackageConfig }
      // Developer tooling
      tools?: { [#Slug]: #ToolConfig }
      // Artifact groups for organization
      groups?: { [#Slug]: #GroupSpec }
      // Work items tracking spec changes
      issues?: { [#Slug]: #IssueConfig }
      // Comments attached to entities (discussions, agent guidance, memory)
      comments?: { [#Slug]: #CommentConfig }
      // Explicit relationships between entities (complements implicit deps)
      relationships?: { [#Slug]: #RelationshipSpec }
    }
