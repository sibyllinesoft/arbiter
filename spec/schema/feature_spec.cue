    package schema

    import "list"

    #FeatureSpec: {
      feature: {
        id: "quick-approve" | #Slug // id must be a slug; example provided
        title: #Human
        owners: [...#Email] & list.MinItems(1)
        state?: "experimental" | "beta" | "ga"
        scope?: {
          routes?:   [...#RouteID]
          schemas?:  [...=~"^[A-Z][A-Za-z0-9]*$"]
          locators?: [...#LocatorToken]
          flows?:    [...#FlowID]
        }
        completionProfile?: #CompletionProfile
      }

      // Overlay fragments (optional)
      ui?:       { routes?:  [...#AppSpec.ui.routes.Elem] }
      locators?: { [#LocatorToken]: #CssSelector }
      flows?:    [...#AppSpec.flows.Elem]
      components?: { schemas?: #AppSpec.components.schemas }
      paths?:    #AppSpec.paths
      testability?: #AppSpec.testability
      processes?: #AppSpec.processes
    }

    #CompletionProfile: {
      minSchemas?:          int & >=0
      requireExamplePerSchema?: bool
      minRoutes?:           int & >=0
      locatorCoveragePct?:  #Percent01
      minFlows?:            int & >=0
      minOraclesPerFlow?:   int & >=0
      requireClock?:        bool
      requireNetworkStubs?: bool
    }
