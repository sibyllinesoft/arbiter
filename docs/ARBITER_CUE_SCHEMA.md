# Arbiter Schema v2 — Agent Guide & Change Log

**TL;DR:** Treat the CUE spec as a _single source of truth_ across four
layers—**Domain → Contracts → Capabilities → Execution**—compiled into a
deterministic IR. Keep frameworks as _adapters_, lock generation with
`codegen.profile`+`templateHash`, and enforce compatibility gates. The result:
reproducible scaffolds, migrations, APIs, infra, tests, and ops from one spec.

---

## 0) Scope & Goals

**Goal:** Enable AI agents to regenerate functionally identical software (within
defined compatibility rules) from the spec.

**Design levers:**

- Model _what_ the system means (Domain), _how it communicates_ (Contracts),
  _what a service does_ (Capabilities), and _how it runs_ (Execution).
- Deterministic codegen via profiles, template hashing, stable component IDs,
  and artifact digests.
- Validation/compat passes that detect breaking changes and require semver bumps
  or explicit migrations.

---

## 1) Schema Overview (Conceptual)

- **Domain:** Business types, invariants, state machines. Source of truth for
  data, not the database.
- **Contracts:** Synchronous (HTTP/RPC) and asynchronous (events) interfaces
  with explicit versions and compatibility policy.
- **Capabilities:** Per–service declarations of roles (HTTP server, queue
  consumer, cron job, worker, CLI) bound to Contracts and Domain ownership.
- **Execution:**
  Build/runtime/infra/deploy/observability/security/overlays—where it actually
  runs.

---

## 2) Core CUE Layout (Authoring Surface)

```cue
package assembly

arbiterSpec: {
  // ----- Metadata -----
  meta: {
    name:        string
    version:     string           // project semver; compat gates apply here
    description: string | *""
    repository?: string
    license?:    string           // SPDX
    team?:       string
  }

  // ----- Runtime defaults (overridable per service) -----
  runtime: #Runtime

  // ----- Product classification -----
  kind?: "library" | "application" | "service" | "tool"

  // ----- Domain model (source of truth for business types) -----
  domain?: {
    entities?:      {[Name=string]: #Entity}
    valueObjects?:  {[Name=string]: #ValueObject}
    events?:        {[Name=string]: #DomainEvent}
    stateMachines?: {[Name=string]: #StateMachine}
    invariants?:    [...#Invariant]
  }

  // ----- Interface contracts (sync + async) -----
  contracts?: {
    http?:  {[Api=string]: #HTTPContract}
    rpc?:   {[Svc=string]: #RPCContract}
    events?:{[Bus=string]: #EventBus}
    // Shared schema library for reuse across contracts
    schemas?: {[Name=string]: #SchemaDef}
    compat?: #CompatPolicy
  }

  // ----- Services (bind to domain/contracts, then run) -----
  services: {[ServiceName=string]: #Service}

  // ----- Managed infrastructure (cloud resources) -----
  infrastructure?: {
    databases?:      {[DB=string]: #ManagedDatabase}
    caches?:         {[C=string]: #ManagedCache}
    messageQueues?:  {[Q=string]: #MessageQueue}
    storageBuckets?: {[B=string]: #StorageBucket}
  }

  // ----- Execution (deploy + ops) -----
  deployment: #Deployment

  volumes?:  {[VolumeName=string]: #Volume}
  networks?: {[NetworkName=string]: #Network}

  // ----- Code generation controls (determinism) -----
  codegen?: #Codegen
}
```

---

## 3) Types (Detailed)

### 3.1 Runtime & Development

```cue
#Runtime: {
  language:       "typescript" | "python" | "rust" | "go" | "javascript" | "java" | "csharp"
  version:        string              // e.g., "20.11.1" (node), "3.11" (python)
  packageManager: "pnpm" | "npm" | "yarn" | "pip" | "poetry" | "cargo" | "go" | "maven" | "gradle"
  framework?:     string              // adapter hint (e.g., "fastify", "fastapi", "axum", "gin")
  linter?:        string              // e.g., "eslint", "ruff", "clippy"
  formatter?:     string              // e.g., "prettier", "black", "rustfmt"

  development?: {
    structure?: {
      srcDir?:    string | *"src"
      testDir?:   string | *"tests"
      buildDir?:  string | *"dist"
      configDir?: string | *"config"
    }
    quality?: {
      testCoverage?:   int & >=0 & <=100 | *0
      linting?:        bool | *true
      codeFormatting?: bool | *true
      securityScan?:   bool | *true
      documentation?: {
        generate: bool | *true
        format?:  "markdown" | "asciidoc" | "html" | *"markdown"
      }
    }
    dependencies?: {
      registries?: [...{
        name: string
        url:  string
        type: "npm" | "pypi" | "crates" | "maven" | "docker"
      }]
    }
  }
}
```

### 3.2 Domain Modeling

```cue
#ScalarType: "string" | "text" | "int" | "float" | "bool" | "uuid" | "timestamp" | "json" | "decimal"

#Field: {
  type:        #ScalarType | "relation"
  description?: string
  optional?:    bool | *false
  primaryKey?:  bool | *false
  unique?:      bool | *false
  default?:     string | int | bool | number
  relation?: {
    to:       string // target entity name
    kind:     "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"
    onDelete: "cascade" | "set null" | "restrict" | *"restrict"
  }
  validators?: [...#Validator]
}

#Entity: {
  keys?:   [...string] // optional composite key; else inferred from primaryKey fields
  fields:  {[FieldName=string]: #Field}
  indexes?: [...#Index]
}

#ValueObject: {
  fields: {[FieldName=string]: #Field}
}

#DomainEvent: {
  payload: string | #SchemaDef // ref to ValueObject/Entity or inline schema
}

#StateMachine: {
  states: [...string]
  initial: string
  transitions: [...{
    from: string
    to:   string
    guard?:   string   // named guard (evaluated in generated code)
    action?:  string   // named action (side-effects stub)
    idempotent?: bool | *true
  }]
}

#Validator: {
  name: string         // e.g., "email", "minLen", "regex:..."
  message?: string
}

#Index: {
  name?: string
  fields: [...string]
  unique?: bool | *false
}
```

### 3.3 Contracts (HTTP/RPC/Events)

```cue
#CompatPolicy: {
  kind: "semver" | *"semver"
  breakingRules?: [..."removeField", "tightenEnum", "changeType", "removeEndpoint", "removeEventType"]
}

#SchemaDef: {
  // Minimal inline schema; agents may compile to JSON Schema/OpenAPI components
  type: "object"
  properties: {[k=string]: {
    type: "string" | "number" | "integer" | "boolean" | "object" | "array"
    nullable?: bool | *false
    items?:    _|_ | {type: string}
  }}
  required?: [...string]
  description?: string
}

#HTTPContract: {
  version: string
  basePath?: string | *"/"
  endpoints: {
    [Path=string]: {
      [Method=("get"|"post"|"put"|"patch"|"delete")]: #HTTPEndpoint
    }
  }
}

#HTTPEndpoint: {
  summary?: string
  tags?:    [...string]
  request?: {
    pathParams?:  #SchemaDef | string
    query?:       #SchemaDef | string
    headers?:     #SchemaDef | string
    body?:        #SchemaDef | string
  }
  responses: {
    [Status=string]: { // "200", "201", "400", ...
      description?: string
      body?:        #SchemaDef | string
      headers?:     #SchemaDef | string
    }
  }
  assertions?: #EndpointAssertions
  auth?: {
    required?: bool | *false
    scopes?:   [...string]
  }
}

#EndpointAssertions: {
  [AssertionName=string]: #CueAssertion
}

#CueAssertion: bool | {
  assert:   bool
  message?: string
  severity?: "error" | "warn" | "info"
  tags?:    [...string]
}

#RPCContract: {
  version: string
  methods: {[Name=string]: {
    request:  #SchemaDef | string
    response: #SchemaDef | string
  }}
}

#EventBus: {
  version: string
  protocol: "kafka" | "rabbitmq" | "gcp-pubsub" | "aws-sns-sqs"
  topics: {[Topic=string]: {
    eventTypes: {[Event=string]: {
      payload: #SchemaDef | string
      description?: string
    }}
    orderingKey?: string
  }}
}
```

### 3.4 Service & Capabilities

```cue
#Service: {
  type: "bespoke" | "prebuilt" | "external"
  runtime?: #Runtime
  sourceDirectory?: string     // bespoke
  image?: string               // prebuilt

  // What this service *does* (binds to contracts & domain)
  implements?: {
    apis?:      [...string]    // keys of contracts.http / contracts.rpc
    models?:    [...string]    // domain entities/valueObjects primarily owned here
    publishes?: [...{ topic: string, event: string, retries?: int & >=0 | *0 }]
    subscribes?:[...{ topic: string, event?: string, consumerGroup?: string }]
  }

  capabilities?: [...#Capability]

  // Execution/runtime
  ports?: [...int]
  replicas?: int & >=1 | *1
  healthCheck?: #HealthCheck
  config?:      #ServiceConfig
  volumes?:     [...#VolumeMount]
  resources?:   #ResourceRequirements
  dependencies?:[...string]   // other services or infra by name

  serviceType?: "deployment" | "statefulset" | "daemonset" | "job" | "cronjob"
  labels?:      {[string]: string}
  annotations?: {[string]: string}
}

#Capability: {
  kind: "httpServer" | "rpcServer" | "queueConsumer" | "cronJob" | "worker" | "cli"
  contractRef?: string     // e.g., "contracts.http.PublicAPI@v1"
  adapter?: {
    name:    string        // e.g., "fastify", "fastapi", "axum"
    version?: string
    options?: {...}
  }
  features?: {
    auth?:        {mode: "jwt" | "oidc" | "mTLS", scopes?: [...string]}
    rateLimit?:   {requestsPerSec: int, burst?: int}
    cors?:        {origins: [...string]}
    compression?: bool | *true
    middlewares?: [...string]
  }
  // for cron
  schedule?: string  // cron expr
}

#CapabilitySpec: {
  name?: string
  description?: string
  owner?: string
  gherkin?: string         // Behaviour scenarios expressed in Given/When/Then
  depends_on?: [...string]
  tags?: [...string]
}

#HealthCheck: {
  path:      string
  interval?: string | *"30s"
  timeout?:  string | *"10s"
  retries?:  int & >=1 | *3
}

#ServiceConfig: {
  environment?: {[string]: #ConfigValue}
  files?: [...#ConfigFile]
  secrets?: [...#Secret]
}

#ConfigValue: string | {
  value:    string
  type?:    "string" | "number" | "boolean" | "json"
  required: bool | *false
  default?: string
}

#ConfigFile: {
  source:      string
  destination: string
  readonly?:   bool | *false
}

#Secret: {
  name:      string
  key:       string
  value?:    string
  external?: string
}

#VolumeMount: {
  type:      "persistentVolumeClaim" | "configMap" | "secret" | "emptyDir"
  name:      string
  mountPath: string
  subPath?:  string
  readonly?: bool | *false
}

#ResourceRequirements: {
  requests?: { cpu?: string, memory?: string }
  limits?:   { cpu?: string, memory?: string }
}
```

### 3.5 Execution: Deployment, Observability, Security

```cue
#Deployment: {
  target: "kubernetes" | "aws" | "gcp" | "azure"

  ingress?: {
    [Name=string]: #Ingress
  }

  testing?: {
    artifacts?: [...("compose" | "docker" | "vagrant")]
    localDevelopment?: bool | *true
  }

  cluster?: {
    name:     string
    provider: "kubernetes" | "eks" | "gke" | "aks"
    context?: string
    namespace?: string
    config?: {...}
  }

  compose?: {
    version?:     "3.8" | "3.9"
    networks?:    {[string]: {...}}
    volumes?:     {[string]: {...}}
    profiles?:    [...string]
    environment?: {[string]: string]
  }

  strategies?: { blueGreen?: bool, canary?: bool, rolling?: bool, recreate?: bool }

  observability?: {
    logs?:    { level?: "debug" | "info" | "warn" | "error" | *"info", schema?: string }
    metrics?: { counters?: [...string], gauges?: [...string], latencyBuckets?: [...int] }
    tracing?: { sampler?: "always" | "ratio", ratio?: number | *0.1 }
    slos?:    [...{ name: string, indicator: string, objective: string, window: string, alertPolicy?: string }]
  }

  security?: {
    auth?: { mode: "jwt" | "oidc" | "mTLS", issuers?: [...string], scopes?: [...string] }
    serviceAcl?: [...{ from: string, to: string, contractRef: string }]
    dataClassifications?: {[path=string]: "public" | "internal" | "confidential" | "restricted"}
  }

  autoscaling?: { hpa?: {...}, keda?: {...} }
  mesh?: { provider: "istio" | "linkerd" }
}

#Ingress: {
  host: string
  tls?: { secretName: string, issuer?: string }
  paths: {[p=string]: { serviceName: string, servicePort: int }}
}

#ManagedDatabase: {
  engine:  "postgres" | "mysql" | "mongodb"
  version: string
  size:    string | *"small"
  retentionDays?: int | *7
}
#ManagedCache: { engine: "redis" | "memcached", version?: string, size?: string }
#MessageQueue: { engine: "kafka" | "rabbitmq" | "sqs-sns" | "pubsub", version?: string }
#StorageBucket: { provider: "s3" | "gcs" | "azure-blob", versioning?: bool | *true }

#Volume: {
  type: "persistentVolumeClaim" | "configMap" | "secret" | "emptyDir"
  size?:         string
  storageClass?: string
  accessModes?:  [...string]
  items?: [...{ key: string, path: string, mode?: int }]
  labels?:      {[string]: string}
  annotations?: {[string]: string}
}

#Network: {
  type:     "internal" | "external"
  driver?:  string
  options?: {[string]: string}
  labels?:  {[string]: string}
}
```

### 3.6 Codegen Determinism & Compatibility

```cue
#Codegen: {
  profile:          string                   // maps language×capabilities→templates/layout
  generator:        string                   // e.g., "arbiter/gen@1.6.2"
  templateHash:     string                   // sha256 of template bundle
  componentIdSeed?: string                   // stable seed; derive per-service UUIDs
  artifactDigests?: {
    contractsBundle?: string
    schemaBundle?:    string
    renderedScaffold?:string
    migrations?:      string
  }
  compat?: #CompatPolicy
}
```

---

## 4) Validation Rules (Agent MUST enforce)

1. **Binding completeness:** Every `capability.contractRef` must resolve to an
   existing contract; every `implements.apis` must point to a
   `contracts.http|rpc` key; every `publishes/subscribes` topic must exist in
   `contracts.events`.
2. **Domain referential integrity:** Schema refs used in contracts (`string`
   names) must resolve to `domain.entities|valueObjects` or `contracts.schemas`.
3. **Ownership clarity:** Entities listed in `implements.models` may appear in
   only one service (primary owner) unless `shared:true` is explicitly marked
   (optional extension).
4. **Compat gates:** Changes flagged by `codegen.compat.breakingRules` require
   `meta.version` bump or a `migrations` block with `allowBreak:true`.
5. **Determinism:** `codegen.profile + generator + templateHash` must be present
   for full codegen; agent must produce digests and write them back into
   `artifactDigests`.
6. **Typed config:** `config.environment` values with `required:true` must be
   satisfied per environment overlay or generation fails.
7. **State machine soundness:** All transitions reference valid states;
   `initial` is a member of `states`; optional guards/actions must be declared
   in a stubs manifest.

---

## 5) IR & Pipeline (for the Agent)

**IR graph nodes:**
`Service, Capability, Contract(HTTP/RPC/Event), Model(Entity/VO), InfraResource, Ingress`.

**Pass order (must be stable):**

1. **Normalize:** Fill defaults (runtime/development), expand adapters by
   profile.
2. **Resolve:** Bind contract/model refs; compute ownership map.
3. **Validate:** Apply rules above + schema well-formedness.
4. **Plan:** Select generators per capability: HTTP server, clients, RPC stubs,
   event producers/consumers, migrations, config, tests, CI, k8s.
5. **Materialize:** Emit files with deterministic paths using stable
   `componentId` + template rules.
6. **Fingerprint:** Compute digests; update `codegen.artifactDigests`.

**Deterministic path scheme (example):**

```
services/<svc>/src/{adapters}/{componentId-prefix}/...
contracts/bundles/openapi.<version>.yaml
migrations/<db>/<timestamp>__<entityChange>.sql
k8s/<env>/<svc>/*.yaml
```

---

## 6) Changes from Original Schema (Mapping)

- **Added:** `domain`, `contracts`, `capabilities`, `infrastructure`, `runtime`,
  `codegen`, `deployment.observability`, `deployment.security`,
  `deployment.strategies`.
- **Replaced/clarified:**
  - _Old_ `language` → _New_ `runtime.language` with version, package manager,
    formatter/linter.
  - _Old_ `services.*.language` → `services.*.runtime` (optional override).
  - _Old_ `services.*` ports/health/resources/config/volumes **unchanged**, but
    `config.environment` now supports typed `#ConfigValue`.
  - _Old_ implicit HTTP services → _New_ explicit `capabilities` with
    `contractRef` binding.
  - _Old_ database volumes in `services` → _New_ managed infra in
    `infrastructure.databases` (services depend by name).

- **New determinism controls:** `codegen.profile`, `generator`, `templateHash`,
  `artifactDigests`, and compat policy.

**Upgrade guide (mechanical):**

1. Move top-level `language` to `runtime.language` and add
   `version`/`packageManager`.
2. For each HTTP-like service, add
   `capabilities: [{kind: "httpServer", contractRef: "contracts.http.<YourAPI>@v1"}]`
   and define `contracts.http` accordingly.
3. Move DB containers to `infrastructure.databases` where possible; keep
   `prebuilt` services only for things you truly manage as containers.
4. Introduce `codegen` block with profile+generator+templateHash.

---

## 7) Agent Output Expectations (What to Generate)

**From Domain:**

- Types/DTOs in each language; validators; state-machine stubs; invariant
  checks.
- DB migrations (Domain→Store projection) with rollback notes.

**From Contracts:**

- OpenAPI/Proto bundles; servers (routing + input/output models) and typed
  clients.
- Event schemas; producer/consumer scaffolds; idempotency keys.

**From Capabilities:**

- Adapter-wired bootstraps (Fastify/FastAPI/Axum/etc.), middlewares (auth, CORS,
  rate limit), CLI/cron runners.

**From Execution:**

- K8s manifests (deploy/service/ingress/hpa), Compose for local, CI/CD
  pipelines.
- Observability (exporters, dashboards), SLO alerts, security policies.

**From Codegen:**

- Stable file layout; SBOM if enabled; artifact digests updated back into spec.

---

## 8) Authoring Tips & Guardrails (for Agents)

- Treat frameworks/ORM/testing tools as **adapters**—respect hints but keep
  generators swappable.
- Fail fast on missing bindings (`contractRef`, schema refs, required config).
- Never invent business logic: generate stubs with explicit `// TODO(agent):`
  markers tied to `componentId`.
- Prefer _declarative policy_ (auth scopes, rate limits, SLOs) over embedded
  imperative code.
- Keep migrations additive when possible; when destructive, require
  `meta.version` bump + `allowBreak:true`.
- Emit golden snapshots and compare digests on regeneration; if mismatch, show
  diff summary.

---

## 9) Minimal End‑to‑End Example

```cue
package assembly

arbiterSpec: {
  meta: { name: "blog", version: "2.0.0" }
  runtime: { language: "typescript", version: "20.x", packageManager: "pnpm", framework: "fastify" }

  domain: {
    entities: {
      User: { fields: { id: {type:"uuid", primaryKey:true}, email: {type:"string", unique:true} } }
      Post: { fields: { id:{type:"uuid", primaryKey:true}, title:{type:"string"}, authorId:{type:"relation", relation:{to:"User", kind:"many-to-one", onDelete:"cascade"}} } }
    }
  }

  contracts: {
    http: {
      PublicAPI: {
        version: "v1"
        endpoints: {
          "/posts": {
            get:  { responses: { "200": { body: {type:"object", properties:{ items:{type:"array", items:{type:"object"}} }, required:["items"] } } } }
            post: { request: { body: "Post" }, responses: { "201": { body: "Post" } } }
          }
        }
      }
    }
    compat: { kind: "semver", breakingRules: ["removeField","removeEndpoint"] }
  }

  infrastructure: { databases: { primary: { engine: "postgres", version: "15" } } }

  services: {
    api: {
      type: "bespoke"
      sourceDirectory: "./services/api"
      implements: { apis: ["PublicAPI"], models:["User","Post"] }
      capabilities: [{ kind:"httpServer", contractRef:"contracts.http.PublicAPI@v1", adapter:{name:"fastify"} }]
      config: { environment: { DATABASE_URL: { required: true, type:"string" } } }
      ports: [8080]
      dependencies: ["primary"]
    }
  }

  deployment: { target: "kubernetes" }
  codegen: { profile:"ts-fastify-postgres-k8s@1", generator:"arbiter/gen@1.6.2", templateHash:"sha256:..." }
}
```

---

## 10) Open Questions / Extensions (Optional)

- Shared model ownership (`shared:true`) and data contracts between bounded
  contexts.
- Policy DSL for authorization (ABAC/RBAC) and data retention.
- Environment overlays with explicit merge strategies
  (`merge:"deep"|"replace"`).

---

## 11) Summary

This v2 schema elevates Arbiter from deployment config to an application model.
With bindings, adapters, and deterministic codegen controls, agents can
regenerate consistent scaffolds and ops artifacts while guarding against
accidental drift.
