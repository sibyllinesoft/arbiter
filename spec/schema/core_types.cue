    package schema

    // ---------- Canonical identifiers & primitives ----------
    #Slug:          =~"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
    #Human:         string & !=""                              // short human label
    #Email:         =~"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$"
    #ISODateTime:   =~"^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$"
    #UUID:          =~"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    #Percent01:     number & >=0.0 & <=1.0
    #URL:           =~"^https?://[^\\s]+$"                      // full URL (http/https)
    #URLPath:       =~"^/[A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]*$"
    #HTTPMethod:    "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    #HTTPStatus:    int & >=100 & <=599

    // ---------- Entity metadata ----------
    // Base metadata for all tracked entities - enables UUID tracking and timestamps
    #EntityMeta: {
        // Stable UUID identifier - persists across renames
        // Named 'entityId' to avoid conflict with semantic IDs (e.g., #FlowID, #Slug)
        entityId?:  #UUID
        // Creation timestamp (ISO 8601)
        createdAt?: #ISODateTime
        // Last modification timestamp (ISO 8601)
        updatedAt?: #ISODateTime
    }

    // ---------- Domain tokens ----------
    #RouteID:       =~"^[a-z0-9]+(?::[a-z0-9_-]+)+$"           // e.g., invoices:detail
    #Cap:           #Slug                                      // capability, e.g., approve
    #Role:          #Slug                                      // role, e.g., manager

    // Actor/persona definition - users, external systems, or services that interact with the system
    #ActorSpec: {
        // Display name
        name: #Human
        // Description of the actor's role/purpose
        description?: string
        // Actor type: human user or external system/service
        type?: "human" | "system" | *"human"
        // Whether this actor is external to the system boundary
        external?: bool | *false
    }

    // ---------- Issue tracking ----------
    // Entity types that can be referenced by issues
    // Container level: service, client, package, tool, group
    // Component level: endpoint, view
    #EntityType: "service" | "client" | "package" | "tool" | "group" |
                 "endpoint" | "view" |
                 "capability" | "operation" | "behavior" | "issue" | "actor"

    // Structured reference to another entity
    #EntityRef: {
        type:   #EntityType
        slug:   #Slug
        // Optional label for display (auto-resolved from referenced entity)
        label?: #Human
    }

    // Issue workflow states
    #IssueStatus: "open" | "in-progress" | "resolved" | "closed" | "wont-fix"

    // Issue priority levels
    #IssuePriority: "critical" | "high" | "medium" | "low"

    // ---------- Locator contract ----------
    #LocatorToken:  =~"^[a-z]+:[a-z0-9_-]+$"                   // e.g., btn:approve
    #CssSelector:   string & =~"^[^\\n\\r]+$" & !=""           // non-empty single-line

    // ---------- Flow steps ----------
    #FlowID:        #Slug
    #StateKind:     "visible" | "hidden" | "enabled" | "disabled" | "attached" | "detached"
    #TextMatch:     { eq?: string, contains?: string, regex?: string } // one of these

    #ExpectUI: {
      locator: #LocatorToken
      state?:  #StateKind
      text?:   #TextMatch
    }

    #ExpectAPI: {
      method:  #HTTPMethod
      path:    #URLPath
      status:  #HTTPStatus
      bodyExample?: _
      headers?: { [string]: string }
    }

    // ---------- Assertion helpers ----------
    #AssertionSeverity: "error" | "warn" | "info"

    #CueAssertion: bool | {
      assert:   bool
      message?: #Human
      severity?: #AssertionSeverity
      tags?:    [...#Slug]
    }

    #CueAssertionBlock: {[#Slug]: #CueAssertion}

    // ---------- Seeds & factories ----------
    #FactoryName:   #Slug
    #Seed: {
      factory: #FactoryName
      as:      #Slug
      with?:   _
    }

    // ---------- Misc ----------
    #KV: { [string]: _ } // loose map where needed
