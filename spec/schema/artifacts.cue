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
      // Source entity slug (package, resource, group)
      from: #Slug
      // Target entity slug
      to: #Slug
      // Human-readable description of the relationship
      label?: string
      // Detailed description
      description?: string
      // Relationship semantics - open-ended to support various contexts
      // Common: uses, depends_on, calls, reads, writes, deployed_as, authenticates, notifies
      type?: #Slug | *"uses"
      // Technology or protocol (e.g., "HTTPS/JSON", "gRPC", "PostgreSQL", "AMQP")
      technology?: string
      // Whether the relationship is bidirectional
      bidirectional?: bool | *false
      // Tags for filtering/categorization
      tags?: [...#Slug]
    }

    // ProjectStructureConfig defines directory layout hints
    // Note: Uses subtype-based directories (services, clients, tools) for backward compatibility
    // with existing projects. Future versions may consolidate to a single packagesDirectory.
    #ProjectStructureConfig: {
      // Primary location for client-facing applications (frontends)
      clientsDirectory?:  string & !=""
      // Primary location for backend and API services
      servicesDirectory?: string & !=""
      // Shared packages and domain libraries
      packagesDirectory?: string & !=""
      // Developer tooling, CLIs, and automation scripts
      toolsDirectory?:    string & !=""
      // Project documentation output
      docsDirectory?:     string & !=""
      // Shared test suites and golden fixtures
      testsDirectory?:    string & !=""
      // Infrastructure as code and deployment assets
      infraDirectory?:    string & !=""
      // Flags that force certain artifact directories to live inside their owning package
      packageRelative?: {
        docsDirectory?:  bool
        testsDirectory?: bool
        infraDirectory?: bool
      }
    }

    // ---------- Package Configuration (Master Type for Code Artifacts) ----------

    // Package subtype - determines polymorphic behavior
    // Agents set this after import to unlock subtype-specific fields
    #PackageSubtype: "service" | "frontend" | "tool" | "library" | "worker"

    // Handler reference - points to code module or another package's endpoint
    #HandlerReference: {
      // Module-based handler (local code)
      module?: string
      function?: string
    } | {
      // Endpoint-based handler (proxy to another package)
      package: #Slug
      endpoint: #Slug
    }

    // Middleware reference for request/response processing
    #MiddlewareReference: {
      name: #Slug
      phase?: "request" | "response" | *"request"
      config?: { [string]: _ }
    }

    // EndpointSpec defines an API endpoint within a service package (component level)
    #EndpointSpec: {
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

    // ViewSpec defines a view/route within a frontend package (component level)
    #ViewSpec: {
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

    // CommandSpec defines a CLI command within a tool package
    #CommandSpec: {
      name: string & !=""
      description?: string
      entrypoint?: string
      arguments?: [...{
        name: string
        description?: string
        required?: bool
      }]
    }

    // PackageConfig is the master type for any code artifact with a manifest.
    // All code artifacts (services, frontends, tools, libraries) are packages.
    // The `subtype` field enables polymorphism - unlocking subtype-specific fields.
    #PackageConfig: {
      #EntityMeta
      name?:        #Human
      description?: string

      // Language is required - detected from manifest
      language:     string & !=""

      // Source details
      manifest?:        string  // path to package.json, Cargo.toml, go.mod, etc.
      sourceDirectory?: string

      // Subtype for polymorphism - optional, agent decides after import
      subtype?:     #PackageSubtype

      // Common optional fields
      framework?:   string
      template?:    string
      tags?:        [...#Slug]
      memberOf?:    #Slug

      // Arbitrary metadata for context-specific properties
      // Unknown CLI flags become metadata entries
      metadata?:    { [string]: _ }

      // ---------- Service/Worker fields (when subtype is "service" or "worker") ----------
      port?:        int & >0
      healthCheck?: {
        path?:     #URLPath
        port?:     int & >0
        protocol?: string
        interval?: string
        timeout?:  string
      }
      endpoints?:   { [#Slug]: #EndpointSpec }
      env?:         { [string]: string }
      workload?:    "deployment" | "statefulset" | "daemonset" | "job" | "cronjob"
      replicas?:    int & >0

      // ---------- Frontend fields (when subtype is "frontend") ----------
      views?:       { [#Slug]: #ViewSpec }

      // ---------- Tool fields (when subtype is "tool") ----------
      commands?:    [...#CommandSpec]
      bin?:         { [string]: string }
    }

    // ---------- Resource Configuration (Infrastructure without Code) ----------

    // Resource kind - infrastructure type
    #ResourceKind: "database" | "cache" | "queue" | "storage" | "container" | "gateway" | "external"

    // ResourceConfig is for infrastructure - things referenced in Docker/K8s/Terraform
    // that don't have their own code manifest. When a Resource corresponds to a Package,
    // they are linked via a "deployed_as" relationship.
    #ResourceConfig: {
      #EntityMeta
      name?:        #Human
      description?: string

      // Resource kind - required
      kind:         #ResourceKind

      // Container/image details (from Docker/K8s)
      image?:       string
      ports?: [...{
        name:       string
        port:       int & >0
        targetPort?: int & >0
        protocol?:  string
      }]

      // Provider details (for managed services from Terraform)
      provider?:    string  // aws, gcp, azure, etc.
      engine?:      string  // postgres, mysql, redis, etc.
      version?:     string

      // Environment variables
      env?:         { [string]: string }

      // Resource specs
      resources?: {
        requests?: { cpu?: string, memory?: string }
        limits?:   { cpu?: string, memory?: string }
      }

      // Health check (from K8s probes)
      healthCheck?: {
        path?:     #URLPath
        port?:     int & >0
        protocol?: string
        interval?: string
        timeout?:  string
      }

      // Arbitrary metadata
      metadata?:    { [string]: _ }

      tags?:        [...#Slug]
      memberOf?:    #Slug
    }

    // ---------- Issue Tracking ----------

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
      // Type of target entity (e.g., "issue", "package", "endpoint")
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
      // Code artifacts (services, frontends, tools, libraries)
      packages?: { [#Slug]: #PackageConfig }
      // Infrastructure resources (databases, caches, containers)
      resources?: { [#Slug]: #ResourceConfig }
      // Artifact groups for organization
      groups?: { [#Slug]: #GroupSpec }
      // Work items tracking spec changes
      issues?: { [#Slug]: #IssueConfig }
      // Comments attached to entities (discussions, agent guidance, memory)
      comments?: { [#Slug]: #CommentConfig }
      // Explicit relationships between entities (uses, deployed_as, etc.)
      relationships?: { [#Slug]: #RelationshipSpec }
    }
