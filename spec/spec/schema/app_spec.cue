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
      paths?: {                                   // Optional REST description (OpenAPI-lite)
        [#URLPath]: {
          get?:    { response: { $ref?: string, example?: _ } }
          post?:   { request?: { $ref?: string, example?: _ }, response?: { $ref?: string, example?: _ }, status?: #HTTPStatus }
          put?:    { request?: { $ref?: string, example?: _ }, response?: { $ref?: string, example?: _ }, status?: #HTTPStatus }
          patch?:  { request?: { $ref?: string, example?: _ }, response?: { $ref?: string, example?: _ }, status?: #HTTPStatus }
          delete?: { response?: { $ref?: string, example?: _ }, status?: #HTTPStatus }
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

    // ---------- Helpers ----------
    minItems(n: int): { _hiddenMinItems: n }
    minFields(n: int): { _hiddenMinFields: n }
