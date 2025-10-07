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

      // Domain vocabulary & permissions (optional but recommended)
      domain?: {
        enums?: { [#Slug]: [...#Slug] }                // e.g., InvoiceStatus: ["DRAFT","APPROVED","SENT"]
        permissions?: { [#Cap]: [...#Role] }           // e.g., approve: ["manager","admin"]
      }

      // Capability definitions with behavioural specifications
      capabilities?: { [#Slug]: #CapabilitySpec }

      // Data/APIs: simple schema map with examples; can be projected to OpenAPI
      components?: {
        schemas?: {
          [Name=~"^[A-Z][A-Za-z0-9]*$"]: {
            example: _
            examples?: [..._]
            rules?: _
          }
        }
      }
      paths?: {                                   // OpenAPI-style HTTP operations
        [#URLPath]: {
          get?:    #HttpOperation
          post?:   #HttpOperation
          put?:    #HttpOperation
          patch?:  #HttpOperation
          delete?: #HttpOperation
        }
      }

      // UI surface
      ui: {
        routes: [...{
          id:           #RouteID
          path:         #URLPath
          capabilities: [...#Cap] & minItems(1)
          components?:  [...#Human]
        }] & minItems(1)
      }

      // Stable mapping from domain locator tokens to selectors
      locators: { [#LocatorToken]: #CssSelector } & minFields(1)

      // Flows & oracles
      flows: [...#Flow] & minItems(1)

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

      // Optional per-view state machines (XState-like)
      stateModels?: { [#Slug]: #FSM }
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

    #HttpOperation: {
      operationId?: string
      summary?: #Human
      description?: string
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
