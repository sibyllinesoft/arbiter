    package schema

    // ---------- Artifact Groups ----------

    // GroupSpec defines a logical grouping of artifacts.
    // Groups enable organization by feature, domain, or any other criteria.
    #GroupSpec: {
      // Display name of the group
      name: #Human
      // Description of what this group contains
      description?: string
      // Override directory name (defaults to slugified name)
      directory?: #Slug
      // Tags for filtering/categorization
      tags?: [...#Slug]
      // Override project structure within this group
      structure?: #ProjectStructureConfig
      // Parent group (for nested groups)
      memberOf?: #Slug
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

    // ServiceConfig defines a backend service
    #ServiceConfig: {
      name?:        #Human
      description?: string
      language:     string & !=""
      template?:    string
      framework?:   string
      sourceDirectory?: string
      type?:        "internal" | "external"
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
      tags?:        [...#Slug]
      // Group this service belongs to
      memberOf?:    #Slug
    }

    // ClientConfig defines a frontend application
    #ClientConfig: {
      name?:        #Human
      description?: string
      language:     string & !=""
      template?:    string
      framework?:   string
      sourceDirectory?: string
      port?:        int & >0
      env?:         { [string]: string }
      hooks?:       [...string]
      tags?:        [...#Slug]
      // Group this client belongs to
      memberOf?:    #Slug
    }

    // PackageConfig defines a reusable package/library
    #PackageConfig: {
      name?:        #Human
      description?: string
      language?:    string
      template?:    string
      sourceDirectory?: string
      tags?:        [...#Slug]
      // Group this package belongs to
      memberOf?:    #Slug
    }

    // ToolConfig defines developer tooling and automation
    #ToolConfig: {
      name?:        #Human
      description?: string
      language?:    string
      template?:    string
      sourceDirectory?: string
      tags?:        [...#Slug]
      // Group this tool belongs to
      memberOf?:    #Slug
    }

    // IssueConfig defines a trackable work item that references spec entities
    #IssueConfig: {
      // Issue title (required)
      title:        #Human
      // Detailed description of the issue
      description?: string
      // Current workflow status
      status:       #IssueStatus | *"open"
      // Priority level
      priority?:    #IssuePriority
      // References to other entities this issue relates to
      references?:  [...#EntityRef]
      // Person or team responsible
      assignee?:    #Human
      // Labels for categorization
      labels?:      [...#Slug]
      // Due date in ISO format
      due?:         #ISODateTime
      // Creation timestamp
      created?:     #ISODateTime
      // Last update timestamp
      updated?:     #ISODateTime
      // Parent issue for hierarchical tracking
      parent?:      #Slug
      // Related issues (blocked-by, duplicates, etc.)
      related?:     [...{
        issue: #Slug
        type:  "blocks" | "blocked-by" | "duplicates" | "related-to"
      }]
      // Group this issue belongs to
      memberOf?:    #Slug
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
    }
