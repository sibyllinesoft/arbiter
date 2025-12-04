\
    package schema

    import "strings"

    // Top-level “AppSpec” schema. All fragments unify into this shape under /spec/app.
  #AppSpec: {
      product: {
        name:   #Human
        goals?: [...#Human]
        constraints?: [...#Human]
        roles?: [...#Role] & minItems(1)
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
      behaviors: [...#Flow] & minItems(1)

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
      id:            #FlowID
      preconditions?: {
        role?: #Role
        seed?: [...#Seed]
        env?:  #Slug
      }
      steps: [...#Step] & minItems(1)
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
      content: #HttpContent & minFields(1)
    }

    #HttpResponse: {
      description: string
      headers?: { [string]: _ }
      content?: #HttpContent
    }

    #HttpParameter: {
      name: string & !=""
      'in': "path" | "query" | "header" | "cookie"
      description?: string
      required?: bool | *(self.'in' == "path")
      schema?: _
      schemaRef?: string
      deprecated?: bool
      example?: _
    }

    #Operation: {
      id?: string
      version?: string
      description?: #Human
      tags?: [...#Slug]
      deprecated?: bool
      parameters?: [...#HttpParameter]
      requestBody?: #HttpRequestBody
      responses: { [string]: #HttpResponse } & minFields(1)
      assertions?: #CueAssertionBlock
    }

    #CapabilitySpec: {
      name?: #Human
      description?: string
      owner?: #Human
      gherkin?: string
      depends_on?: [...#Cap]
      tags?: [...#Slug]
    }

    // ---------- Helpers ----------
    minItems(n: int): { _hiddenMinItems: n }
    minFields(n: int): { _hiddenMinFields: n }
