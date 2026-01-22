    package schema

    import (
      "list"
    )

    // Top-level “AppSpec” schema. All fragments unify into this shape under /spec/app.
  #AppSpec: {
      product: {
        name:   #Human
        goals?: [...#Human]
        constraints?: [...#Human]
        // Named actors/personas that interact with the system
        actors?: { [#Slug]: #ActorSpec }
        // Simple role list (deprecated - use actors for richer modeling)
        roles?: [...#Role] & list.MinItems(1)
        slos?: {
          p95_page_load_ms?: int & >0
          uptime?:           string // e.g., "99.9%"
        }
      }

      // Capability definitions with behavioural specifications
      capabilities?: { [#Slug]: #CapabilitySpec }

      // Generic resources (supersedes components/paths/ui)
      resources?: { [#Slug]: _ }

      // Operations (formerly contracts.workflows.<name>.operations.*)
      operations?: { [#Slug]: #Operation }

      // Behaviors & oracles (formerly flows)
      behaviors: [...#Flow] & list.MinItems(1)

      // Determinism hooks for tests
      testability?: {
        network?:   { stub?: bool, passthrough?: [...#URLPath] }
        clock?:     { fixed?: #ISODateTime }
        seeds?:     { factories?: { [#FactoryName]: _ } }
        quality_gates?: {
          a11y?: { axe_severity_max?: "minor" | "moderate" | "serious" | "critical" }
          perf?: { p95_nav_ms_max?: int & >0 }
        }
      }

      // Ops / environments (thin)
      ops?: {
        feature_flags?: [...#Slug]
        environments?:  [...#Slug]
        security?:      { auth?: #Slug, scopes?: [...#Slug] }
      }

      // Optional per-view processes (formerly state machines)
      processes?: { [#Slug]: #FSM }
    }

    // ---------- Flow grammar ----------
    #Flow: {
      #EntityMeta
      id:            #FlowID
      preconditions?: {
        role?: #Role
        seed?: [...#Seed]
        env?:  #Slug
      }
      steps: [...#Step] & list.MinItems(1)
      variants?: [...{
        name: #Slug
        override?: _
      }]
    }

    #Step: {
      visit?: string | #RouteID
      click?: #LocatorToken
      fill?:  { locator: #LocatorToken, value: string }
      expect?: #ExpectUI
      expect_api?: #ExpectAPI
    }

    // ---------- FSM shape (minimal) ----------
    #FSM: {
      #EntityMeta
      id:      #Slug
      initial: #Slug
      states:  { [#Slug]: { on?: { [#Slug]: #Slug } } }
    }

    #HttpMediaType: {
      schema?: _
      schemaRef?: string
      example?: _
    }

    #HttpContent: { [string]: #HttpMediaType }

    #HttpRequestBody: {
      description?: string
      required?: bool | *false
      content: #HttpContent  // At least one media type required
    }

    #HttpResponse: {
      description: string
      headers?: { [string]: _ }
      content?: #HttpContent
    }

    #HttpParameter: {
      name: string & !=""
      // Use quoted field name since 'in' is a CUE keyword
      "in": "path" | "query" | "header" | "cookie"
      description?: string
      // Path parameters should typically be required; validated at runtime
      required?: bool
      schema?: _
      schemaRef?: string
      deprecated?: bool
      example?: _
    }

    #Operation: {
      #EntityMeta
      id?: string
      version?: string
      description?: #Human
      tags?: [...#Slug]
      deprecated?: bool
      parameters?: [...#HttpParameter]
      requestBody?: #HttpRequestBody
      responses: { [string]: #HttpResponse }  // At least one response required
      assertions?: #CueAssertionBlock
    }

    #CapabilitySpec: {
      #EntityMeta
      name?: #Human
      description?: string
      owner?: #Human
      gherkin?: string
      depends_on?: [...#Cap]
      tags?: [...#Slug]
    }

