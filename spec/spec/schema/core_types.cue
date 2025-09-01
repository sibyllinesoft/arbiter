\
    package schema

    // ---------- Canonical identifiers & primitives ----------
    #Slug:          =~"^[a-z0-9]+(?:[._-][a-z0-9]+)*$"
    #Human:         string & !=""                              // short human label
    #Email:         =~"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    #ISODateTime:   =~"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
    #Percent01:     number & >=0.0 & <=1.0
    #URLPath:       =~"^/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$"
    #HTTPMethod:    "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    #HTTPStatus:    int & >=100 & <=599

    // ---------- Domain tokens ----------
    #RouteID:       =~"^[a-z0-9]+(?::[a-z0-9_-]+)+$"           // e.g., invoices:detail
    #Cap:           #Slug                                      // capability, e.g., approve
    #Role:          #Slug                                      // role, e.g., manager

    // ---------- Locator contract ----------
    #LocatorToken:  =~"^[a-z]+:[a-z0-9_-]+$"                   // e.g., btn:approve
    #CssSelector:   string & =~"^[^\n\r]+$" & !=""             // non-empty single-line

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

    // ---------- Seeds & factories ----------
    #FactoryName:   #Slug
    #Seed: {
      factory: #FactoryName
      as:      #Slug
      with?:   _
    }

    // ---------- Misc ----------
    #KV: { [string]: _ } // loose map where needed
