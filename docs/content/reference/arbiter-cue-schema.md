# Arbiter Application Schema — Reference

Looking for how to write specs? Jump to the [CUE Authoring Guide](../guides/arbiter-cue-authoring.md).
This page is the raw schema reference; it mirrors the types defined in `spec/schema` and is the single source of truth for field names and shapes.

**TL;DR (context):** Treat the CUE spec as a _single source of truth_ across four
layers—**Domain → Contracts → Capabilities → Execution**—compiled into a
deterministic IR. Keep frameworks as _adapters_, lock generation with
`codegen.profile`+`templateHash`, and enforce compatibility gates. The result:
reproducible scaffolds, migrations, APIs, infra, tests, and ops from one spec.

---

## Table of Contents

### Core Concepts
- [Schema Overview](#schema-overview)
- [Validation Rules](#validation-rules)

### Schema Entities

**Runtime & Development**
- [Runtime](#runtime)

**Domain Modeling**
- [Entity](#entity)
- [ValueObject](#valueobject)
- [Field](#field)
- [DomainEvent](#domainevent)
- [StateMachine](#statemachine)
- [Validator](#validator)
- [Index](#index)

**Contracts**
- [WorkflowContract](#workflowcontract)
- [SchemaDef](#schemadef)
- [Message](#message)
- [CompatPolicy](#compatpolicy)

**Services & Capabilities**
- [Service](#service)
- [ServiceDependency](#servicedependency)
- [Capability](#capability)
- [ServiceEndpoint](#serviceendpoint)
- [HandlerRef](#handlerref)
- [MiddlewareRef](#middlewareref)
- [HealthCheck](#healthcheck)
- [ServiceConfig](#serviceconfig)
- [ResourceRequirements](#resourcerequirements)

**Deployment & Infrastructure**
- [Deployment](#deployment)
- [Ingress](#ingress)
- [Volume](#volume)
- [Network](#network)

**Code Generation**
- [Codegen](#codegen)

---

## Schema Overview

**Goal:** Enable AI agents to regenerate functionally identical software (within
defined compatibility rules) from the spec.

**Design levers:**

- Model _what_ the system means (Domain), _how it communicates_ (Contracts),
  _what a service does_ (Capabilities), and _how it runs_ (Execution).
- Deterministic codegen via profiles, template hashing, stable component IDs,
  and artifact digests.
- Validation/compat passes that detect breaking changes and require semver bumps
  or explicit migrations.

### Core CUE Layout

The root `arbiterSpec` object is the entry point for all Arbiter specifications:

```cue
package assembly

arbiterSpec: {
  meta: {
    name:        string
    version:     string           // project semver; compat gates apply here
    description: string | *""
    repository?: string
    license?:    string           // SPDX
    team?:       string
  }

  runtime: #Runtime              // Runtime defaults (overridable per service)
  kind?: "library" | "application" | "service" | "tool"

  domain?: {
    entities?:      {[Name=string]: #Entity}
    valueObjects?:  {[Name=string]: #ValueObject}
    events?:        {[Name=string]: #DomainEvent}
    stateMachines?: {[Name=string]: #StateMachine}
    invariants?:    [...#Invariant]
  }

  contracts?: {
    workflows?: {[Name=string]: #WorkflowContract}
    schemas?:   {[Name=string]: #SchemaDef}
    compat?:    #CompatPolicy
  }

  services: {[ServiceName=string]: #Service}

  deployments?: {[Env=string]: #Deployment}

  volumes?:  {[VolumeName=string]: #Volume}
  networks?: {[NetworkName=string]: #Network}

  codegen?: #Codegen
}
```

---

## Runtime

Defines the execution runtime, language toolchain, and development environment configuration for the project.

### Schema

```cue
#Runtime: {
  language:       "typescript" | "python" | "rust" | "go" | "javascript" | "java" | "csharp"  // Programming language
  version:        string              // Language/runtime version (e.g., "20.11.1", "3.11")
  packageManager: "pnpm" | "npm" | "yarn" | "pip" | "poetry" | "cargo" | "go" | "maven" | "gradle"  // Package manager
  framework?:     string              // Framework hint for adapter selection (e.g., "fastify", "fastapi", "axum", "gin")
  linter?:        string              // Linter tool (e.g., "eslint", "ruff", "clippy")
  formatter?:     string              // Code formatter (e.g., "prettier", "black", "rustfmt")

  development?: {
    structure?: {
      srcDir?:    string | *"src"       // Source code directory
      testDir?:   string | *"tests"     // Test files directory
      buildDir?:  string | *"dist"      // Build output directory
      configDir?: string | *"config"    // Configuration files directory
    }
    quality?: {
      testCoverage?:   int & >=0 & <=100 | *0   // Minimum test coverage percentage
      linting?:        bool | *true              // Enable linting
      codeFormatting?: bool | *true              // Enable code formatting
      securityScan?:   bool | *true              // Enable security scanning
      documentation?: {
        generate: bool | *true                   // Generate documentation
        format?:  "markdown" | "asciidoc" | "html" | *"markdown"  // Documentation format
      }
    }
    dependencies?: {
      registries?: [...{
        name: string                             // Registry name
        url:  string                             // Registry URL
        type: "npm" | "pypi" | "crates" | "maven" | "docker"  // Registry type
      }]
    }
  }
}
```

### Field Details

**`language`** (required)
: The primary programming language for the project. This drives template selection during code generation and determines which language-specific tooling is available.

**`version`** (required)
: The specific version of the language or runtime. Format varies by language:
  - Node.js/TypeScript: `"20.11.1"`, `"18.x"`
  - Python: `"3.11"`, `"3.12"`
  - Go: `"1.21"`, `"1.22"`
  - Rust: `"1.75"`, `"stable"`

**`packageManager`** (required)
: The package manager used for dependency management. Must be compatible with the selected language.

**`framework`** (optional)
: Framework hint that influences adapter selection during code generation. Common values:
  - TypeScript: `"fastify"`, `"express"`, `"nest"`
  - Python: `"fastapi"`, `"flask"`, `"django"`
  - Rust: `"axum"`, `"actix-web"`
  - Go: `"gin"`, `"echo"`, `"chi"`

**`linter`** (optional)
: Static analysis tool for code quality checks. Examples: `"eslint"`, `"ruff"`, `"clippy"`, `"golangci-lint"`.

**`formatter`** (optional)
: Code formatting tool to ensure consistent style. Examples: `"prettier"`, `"black"`, `"rustfmt"`, `"gofmt"`.

**`development.structure`** (optional)
: Directory structure configuration. Defaults align with common conventions for each language ecosystem.

**`development.quality`** (optional)
: Quality gates and tooling configuration. These settings influence generated CI/CD pipelines and pre-commit hooks.

**`development.dependencies.registries`** (optional)
: Custom package registries for private dependencies or alternate sources. Each registry must specify its type to enable proper authentication and fetching logic.

### Example

```cue
// TypeScript project with Fastify, using pnpm and modern tooling
runtime: {
  language:       "typescript"
  version:        "20.11.1"
  packageManager: "pnpm"
  framework:      "fastify"
  linter:         "eslint"
  formatter:      "prettier"

  development: {
    structure: {
      srcDir:    "src"
      testDir:   "tests"
      buildDir:  "dist"
      configDir: "config"
    }
    quality: {
      testCoverage:   80
      linting:        true
      codeFormatting: true
      securityScan:   true
      documentation: {
        generate: true
        format:   "markdown"
      }
    }
    dependencies: {
      registries: [{
        name: "internal-npm"
        url:  "https://npm.internal.company.com"
        type: "npm"
      }]
    }
  }
}
```

```cue
// Python project with FastAPI, using Poetry
runtime: {
  language:       "python"
  version:        "3.11"
  packageManager: "poetry"
  framework:      "fastapi"
  linter:         "ruff"
  formatter:      "black"

  development: {
    quality: {
      testCoverage: 85
      securityScan: true
    }
  }
}
```

```cue
// Rust project with Axum
runtime: {
  language:       "rust"
  version:        "1.75"
  packageManager: "cargo"
  framework:      "axum"
  linter:         "clippy"
  formatter:      "rustfmt"
}
```

---

## Domain Modeling: Optional but Powerful

> **TL;DR for smaller projects:** Domain modeling (Entities, ValueObjects, DomainEvents, StateMachines) provides powerful benefits for large, complex systems—rich validation, event sourcing, state management, and cross-service data consistency. However, **for smaller projects or rapid prototyping**, you can absolutely skip straight to defining [Services](#service), endpoints, and infrastructure, and still get most of Arbiter's value. The domain layer is optional; start simple and add it when complexity demands it.
>
> **Impatient?** [Jump to Services & Capabilities →](#service)

### When to Use Domain Modeling

**Use domain modeling when:**
- Your system has complex business rules and invariants
- You need rich validation beyond simple type checking
- Multiple services share and depend on the same core entities
- You're building event-sourced or CQRS architectures
- State machines govern important workflows (orders, invoices, approvals)
- You want Arbiter to generate comprehensive database migrations and domain logic

**Skip it when:**
- You're building a simple CRUD API or prototype
- Services are largely independent with minimal shared domain concepts
- You prefer defining schemas directly in service contracts
- Speed and simplicity are more important than exhaustive modeling

---

## Entity

Represents a business domain object with identity and lifecycle. Entities are the core building blocks of the domain model, typically backed by persistent storage.

### Schema

```cue
#Entity: {
  keys?:   [...string]                        // Composite key field names; if omitted, uses primaryKey fields
  fields:  {[FieldName=string]: #Field}       // Field definitions
  indexes?: [...#Index]                       // Database indexes for query optimization
}
```

### Field Details

**`keys`** (optional)
: Composite primary key specification. List field names that together form the unique identifier. If omitted, Arbiter will use fields marked with `primaryKey: true`. Use composite keys for entities with natural multi-column identifiers (e.g., `["tenantId", "resourceId"]`).

**`fields`** (required)
: Map of field definitions. Keys are field names, values are `#Field` definitions. At least one field must be marked as `primaryKey: true` if `keys` is not specified.

**`indexes`** (optional)
: Database indexes to optimize query performance. Particularly important for frequently queried fields or fields used in joins.

### Example

```cue
// Simple entity with auto-generated UUID primary key
entities: {
  User: {
    fields: {
      id: {
        type:       "uuid"
        primaryKey: true
        description: "Unique user identifier"
      }
      email: {
        type:        "string"
        unique:      true
        description: "User email address"
        validators: [{name: "email"}]
      }
      name: {
        type:        "string"
        description: "User full name"
      }
      createdAt: {
        type:        "timestamp"
        default:     "now()"
        description: "Account creation timestamp"
      }
    }
    indexes: [{
      name:   "idx_user_email"
      fields: ["email"]
      unique: true
    }]
  }
}
```

```cue
// Entity with composite key and relations
entities: {
  Invoice: {
    keys: ["tenantId", "invoiceNumber"]  // Composite key
    fields: {
      tenantId: {
        type:       "uuid"
        primaryKey: true
        description: "Tenant identifier for multi-tenancy"
      }
      invoiceNumber: {
        type:       "string"
        primaryKey: true
        description: "Invoice number (unique within tenant)"
      }
      customerId: {
        type:     "relation"
        relation: {
          to:       "Customer"
          kind:     "many-to-one"
          onDelete: "restrict"
        }
        description: "Reference to customer entity"
      }
      amount: {
        type:        "decimal"
        description: "Invoice total amount"
        validators: [{
          name:    "min:0"
          message: "Amount must be positive"
        }]
      }
      status: {
        type:    "string"
        default: "draft"
        description: "Invoice status"
        validators: [{
          name: "enum:draft,pending,paid,cancelled"
        }]
      }
      issuedAt: {
        type:        "timestamp"
        optional:    true
        description: "Invoice issue date"
      }
      paidAt: {
        type:        "timestamp"
        optional:    true
        description: "Payment completion timestamp"
      }
    }
    indexes: [
      {
        name:   "idx_invoice_customer"
        fields: ["customerId", "status"]
      },
      {
        name:   "idx_invoice_issued"
        fields: ["issuedAt"]
      }
    ]
  }
}
```

```cue
// Entity with one-to-many relationship
entities: {
  Post: {
    fields: {
      id: {
        type:       "uuid"
        primaryKey: true
      }
      title: {
        type: "string"
        validators: [{
          name:    "minLen:3"
          message: "Title must be at least 3 characters"
        }]
      }
      content: {
        type: "text"
      }
      authorId: {
        type: "relation"
        relation: {
          to:       "User"
          kind:     "many-to-one"
          onDelete: "cascade"  // Delete posts when user is deleted
        }
      }
      publishedAt: {
        type:     "timestamp"
        optional: true
      }
    }
    indexes: [{
      fields: ["authorId", "publishedAt"]
    }]
  }
}
```

---

## Service

Defines a deployable service unit, either internal (built from source) or external (managed resource like a database).

### Schema

```cue
#Service: {
  type: "internal" | "external"               // Service classification
  source?: {
    package?:    string                       // Source package path
    dockerfile?: string                       // Custom Dockerfile path
    url?:        string                       // External source URL
  }
  workload?: "deployment" | "statefulset" | "daemonset" | "job" | "cronjob"  // Kubernetes workload type
  runtime?: #Runtime                          // Runtime override (inherits from root if omitted)
  image?: string                              // Prebuilt container image reference

  // Capabilities: what this service does
  implements?: {
    apis?:      [...string]                   // Contract references (contracts.workflows.<name>)
    models?:    [...string]                   // Domain entities/VOs owned by this service
    publishes?: [...{
      channel: string                         // Event channel name
      message: string                         // Message type reference
      retries?: int & >=0 | *0                // Retry attempts for publish failures
    }]
    subscribes?: [...{
      channel: string                         // Event channel name to subscribe
      message?: string                        // Expected message type (optional)
      group?:   string                        // Consumer group for load balancing
    }]
  }

  capabilities?: [...#Capability]             // Service capabilities (HTTP server, worker, etc.)

  // Execution & runtime configuration
  ports?: [...int]                            // Exposed ports
  replicas?: int & >=1 | *1                   // Number of replicas
  healthCheck?: #HealthCheck                  // Health check configuration
  config?:      #ServiceConfig                // Environment, files, secrets
  volumes?:     [...#VolumeMount]             // Volume mounts
  resources?:   #ResourceRequirements         // CPU/memory requests and limits

  // Dependencies grouped by type
  dependencies?: {
    services?:  [...#ServiceDependency]       // Service-to-service dependencies
    databases?: [...#ServiceDependency]       // Database dependencies
    caches?:    [...#ServiceDependency]       // Cache dependencies
    queues?:    [...#ServiceDependency]       // Message queue dependencies
    external?:  [...#ServiceDependency]       // External API dependencies
    [Type=string]: [...#ServiceDependency]    // Custom dependency buckets
  }

  labels?:      {[string]: string}            // Kubernetes labels
  annotations?: {[string]: string}            // Kubernetes annotations
  endpoints?:   {[Endpoint=string]: #ServiceEndpoint}  // Named HTTP endpoints

  // For external resources (databases, caches, etc.)
  resource?: {
    kind:     string                          // Resource type (database, cache, queue)
    engine?:  string                          // Engine type (postgres, redis, rabbitmq)
    version?: string                          // Engine version
    tier?:    string                          // Vendor tier/SKU
    size?:    string                          // Instance size (db.m6i.large, etc.)
    backup?: {
      enabled?:       bool | *true
      retentionDays?: int | *7
      window?:        string
      multiRegion?:   bool | *false
    }
    maintenance?: {
      window?: string
    }
    endpoints?: {[name=string]: string}       // Named connection endpoints
    notes?: string
  }
}
```

### Field Details

**`type`** (required)
: Service classification:
  - `"internal"`: Built from source code, deployed as part of the application
  - `"external"`: Managed resource (database, cache, queue) or external API

**`source`** (optional, required for internal services)
: Source code location. Specify one of:
  - `package`: Path to source package (e.g., `"./services/api"`)
  - `dockerfile`: Path to custom Dockerfile
  - `url`: External source repository URL

**`workload`** (optional)
: Kubernetes workload type:
  - `"deployment"`: Stateless applications (default)
  - `"statefulset"`: Stateful applications (databases, caches)
  - `"daemonset"`: Per-node services (logging, monitoring)
  - `"job"`: One-time tasks
  - `"cronjob"`: Scheduled tasks

**`runtime`** (optional)
: Service-specific runtime override. Inherits from root `arbiterSpec.runtime` if omitted.

**`image`** (optional)
: Prebuilt container image reference. Use for services with custom build processes or external images.

**`implements.apis`** (optional)
: List of contract references this service implements. Each entry should reference `contracts.workflows.<InterfaceName>`.

**`implements.models`** (optional)
: List of domain entities/value objects primarily owned by this service. Used for code generation and migration planning.

**`implements.publishes`** (optional)
: Event publishing declarations. Each entry specifies a channel and message type.

**`implements.subscribes`** (optional)
: Event subscription declarations. Supports consumer groups for load balancing.

**`capabilities`** (optional)
: List of service capabilities (HTTP server, worker, CLI, etc.). See [Capability](#capability).

**`ports`** (optional)
: TCP ports exposed by the service. Typically includes application port and optionally metrics/health ports.

**`replicas`** (optional, default: 1)
: Number of pod replicas. Can be overridden per deployment environment.

**`healthCheck`** (optional)
: Health check configuration for liveness and readiness probes.

**`config`** (optional)
: Service configuration including environment variables, files, and secrets.

**`dependencies`** (optional)
: Grouped service dependencies. Organizing by type (services, databases, caches, queues) improves clarity and enables better validation.

**`endpoints`** (optional)
: Named HTTP endpoints with path, methods, and handler bindings. Enables explicit routing and handler references.

**`resource`** (optional, for external services)
: Resource metadata for managed infrastructure (databases, caches). Includes engine type, version, backup config, etc.

### Example

```cue
// Internal HTTP API service
services: {
  InvoiceAPI: {
    type:     "internal"
    workload: "deployment"
    source: {
      package: "./services/invoice-api"
    }

    implements: {
      apis: ["InvoiceWorkflow"]
      models: ["Invoice", "InvoiceLineItem"]
      publishes: [{
        channel: "invoice-events"
        message: "InvoiceCreated"
        retries: 3
      }]
    }

    capabilities: [{
      kind:        "httpServer"
      contractRef: "contracts.workflows.InvoiceWorkflow"
      adapter: {
        name:    "fastify"
        version: "4.x"
      }
      features: {
        auth: {
          mode:   "jwt"
          scopes: ["invoice:read", "invoice:write"]
        }
        rateLimit: {
          requestsPerSec: 100
          burst:          20
        }
        cors: {
          origins: ["https://app.example.com"]
        }
      }
    }]

    ports:    [3000, 9090]  // App + metrics
    replicas: 3

    healthCheck: {
      path:     "/health"
      interval: "30s"
      timeout:  "5s"
      retries:  3
    }

    dependencies: {
      databases: [{
        name:   "primary-db"
        target: "InvoiceDatabase"
        kind:   "postgres"
        version: ">=15"
      }]
      caches: [{
        name:     "session-cache"
        target:   "RedisCache"
        kind:     "redis"
        optional: true
      }]
      queues: [{
        name:   "event-queue"
        target: "EventBus"
        kind:   "nats"
      }]
    }

    config: {
      environment: {
        LOG_LEVEL: {
          value:   "info"
          type:    "string"
          default: "warn"
        }
        DATABASE_URL: {
          value:    "postgres://postgres:5432/invoices"
          type:     "string"
          required: true
        }
        REDIS_URL: {
          value:    "redis://redis:6379"
          required: false
        }
      }
      secrets: [{
        name:     "db-password"
        key:      "DATABASE_PASSWORD"
        external: "aws-secrets-manager://prod/invoice-db"
      }]
    }

    resources: {
      requests: {
        cpu:    "250m"
        memory: "512Mi"
      }
      limits: {
        cpu:    "1000m"
        memory: "1Gi"
      }
    }

    endpoints: {
      getInvoice: {
        path:    "/invoices/{id}"
        methods: ["GET"]
        handler: {
          type:     "module"
          module:   "./handlers/get-invoice.ts"
          function: "handler"
        }
        implements: "contracts.workflows.InvoiceWorkflow.operations.getInvoice"
      }
      createInvoice: {
        path:    "/invoices"
        methods: ["POST"]
        handler: {
          type:     "module"
          module:   "./handlers/create-invoice.ts"
          function: "handler"
        }
        implements: "contracts.workflows.InvoiceWorkflow.operations.createInvoice"
        middleware: [{
          module:   "./middleware/validate-invoice.ts"
          function: "validateInvoiceData"
          phase:    "request"
        }]
      }
    }
  }
}
```

```cue
// External database service
services: {
  InvoiceDatabase: {
    type:     "external"
    workload: "statefulset"

    resource: {
      kind:    "database"
      engine:  "postgres"
      version: "15.4"
      size:    "db.m6i.xlarge"
      tier:    "production"

      backup: {
        enabled:       true
        retentionDays: 30
        window:        "02:00-04:00 UTC"
        multiRegion:   true
      }

      maintenance: {
        window: "sun:05:00-sun:07:00 UTC"
      }

      endpoints: {
        primary:  "invoice-db.cluster-abc123.us-east-1.rds.amazonaws.com:5432"
        readonly: "invoice-db-ro.cluster-abc123.us-east-1.rds.amazonaws.com:5432"
      }

      notes: "Production invoice database with automated backups and read replicas"
    }
  }
}
```

```cue
// Worker service (cron job)
services: {
  InvoiceReminder: {
    type:     "internal"
    workload: "cronjob"
    source: {
      package: "./services/invoice-reminder"
    }

    capabilities: [{
      kind:     "cronJob"
      schedule: "0 9 * * *"  // Daily at 9 AM
    }]

    implements: {
      models: ["Invoice"]
      publishes: [{
        channel: "notification-events"
        message: "ReminderSent"
      }]
    }

    dependencies: {
      databases: [{
        target: "InvoiceDatabase"
      }]
      services: [{
        target:      "EmailService"
        contractRef: "contracts.workflows.EmailAPI"
      }]
    }

    config: {
      environment: {
        REMINDER_DAYS_BEFORE_DUE: {
          value:   "7"
          type:    "number"
          default: "3"
        }
      }
    }
  }
}
```

---

## WorkflowContract

Defines a transport-agnostic interface contract specifying operations (RPC/HTTP) and messages (pub/sub) with versioning and compatibility rules.

### Schema

```cue
#WorkflowContract: {
  version: string                             // Semantic version for compatibility tracking
  summary?: string                            // Brief contract description
  description?: string                        // Detailed contract documentation (markdown)
  operations: {
    [Operation=string]: {
      summary?: string                        // Operation summary
      input?:  #SchemaDef | string            // Input schema (inline or reference)
      output?: #SchemaDef | string            // Output schema (inline or reference)
      errors?: {[Name=string]: #SchemaDef | string}  // Error responses by name
      idempotent?: bool | *false              // Idempotency guarantee
      notes?: string                          // Additional operation notes
    }
  }
  messages?: {
    publishes?:   {[Channel=string]: #Message}  // Events published by this contract
    subscribes?:  {[Channel=string]: #Message}  // Events consumed by this contract
  }
}
```

### Field Details

**`version`** (required)
: Semantic version string for the contract (e.g., `"2024-12-01"`, `"2.0.0"`). Used for compatibility tracking and breaking change detection. Should follow semver or date-based versioning.

**`summary`** (optional)
: Single-line description of the contract's purpose. Displayed in generated documentation and API explorers.

**`description`** (optional)
: Detailed contract documentation in markdown format. Should explain the contract's purpose, design decisions, and usage guidelines.

**`operations`** (required)
: Map of operation definitions. Keys are operation names (e.g., `"getInvoice"`, `"createUser"`), values are operation specifications.

**`operations.<name>.input`** (optional)
: Input schema for the operation. Can be:
  - Inline `#SchemaDef` object
  - String reference to `domain.entities.<Name>`, `domain.valueObjects.<Name>`, or `contracts.schemas.<Name>`

**`operations.<name>.output`** (optional)
: Output schema for the operation. Follows same reference rules as `input`.

**`operations.<name>.errors`** (optional)
: Named error responses. Keys are error names (e.g., `"NotFound"`, `"Unauthorized"`), values are error schemas.

**`operations.<name>.idempotent`** (optional, default: false)
: Whether the operation is idempotent (multiple identical requests have the same effect as a single request). Important for retry logic and client behavior.

**`messages.publishes`** (optional)
: Events published by services implementing this contract. Keys are channel/topic names.

**`messages.subscribes`** (optional)
: Events consumed by services implementing this contract. Keys are channel/topic names.

### Example

```cue
contracts: {
  workflows: {
    InvoiceAPI: {
      version: "2024-12-01"
      summary: "Invoice management API"
      description: """
        # Invoice API

        Provides operations for creating, retrieving, and managing invoices.

        ## Features
        - Create invoices with line items
        - Retrieve invoice details
        - Update invoice status
        - Generate PDF invoices

        ## Authentication
        Requires JWT with `invoice:read` or `invoice:write` scopes.
        """

      operations: {
        getInvoice: {
          summary: "Retrieve invoice by ID"
          input: {
            type: "object"
            properties: {
              id: {type: "string"}
            }
            required: ["id"]
          }
          output: "Invoice"  // Reference to domain.entities.Invoice
          errors: {
            NotFound: {
              type: "object"
              properties: {
                code:    {type: "string"}
                message: {type: "string"}
                invoiceId: {type: "string"}
              }
            }
            Unauthorized: {
              type: "object"
              properties: {
                code:    {type: "string"}
                message: {type: "string"}
              }
            }
          }
          idempotent: true
          notes: "Returns 404 if invoice not found or user lacks access"
        }

        createInvoice: {
          summary: "Create a new invoice"
          input: {
            type: "object"
            properties: {
              customerId: {type: "string"}
              items: {
                type: "array"
                items: {
                  type: "object"
                  properties: {
                    description: {type: "string"}
                    quantity:    {type: "integer"}
                    unitPrice:   {type: "number"}
                  }
                  required: ["description", "quantity", "unitPrice"]
                }
              }
              dueDate: {type: "string"}
            }
            required: ["customerId", "items"]
          }
          output: "Invoice"
          errors: {
            ValidationError: {
              type: "object"
              properties: {
                code:    {type: "string"}
                message: {type: "string"}
                fields:  {
                  type: "object"
                  properties: {
                    [field=string]: {type: "string"}
                  }
                }
              }
            }
          }
          idempotent: false
        }

        updateInvoiceStatus: {
          summary: "Update invoice status"
          input: {
            type: "object"
            properties: {
              id:     {type: "string"}
              status: {type: "string"}  // draft, pending, paid, cancelled
            }
            required: ["id", "status"]
          }
          output: "Invoice"
          idempotent: true
          notes: "Idempotent: setting status to current value is a no-op"
        }

        listInvoices: {
          summary: "List invoices with pagination"
          input: {
            type: "object"
            properties: {
              customerId: {type: "string", nullable: true}
              status:     {type: "string", nullable: true}
              limit:      {type: "integer"}
              offset:     {type: "integer"}
            }
          }
          output: {
            type: "object"
            properties: {
              items: {
                type: "array"
                items: {type: "object"}  // References Invoice entity
              }
              total: {type: "integer"}
              limit: {type: "integer"}
              offset: {type: "integer"}
            }
            required: ["items", "total"]
          }
          idempotent: true
        }
      }

      messages: {
        publishes: {
          "invoice-events": {
            payload: "InvoiceEvent"  // Reference to domain.events.InvoiceEvent
            description: "Published when invoice state changes"
          }
          "invoice-pdf-generated": {
            payload: {
              type: "object"
              properties: {
                invoiceId: {type: "string"}
                pdfUrl:    {type: "string"}
                generatedAt: {type: "string"}
              }
              required: ["invoiceId", "pdfUrl"]
            }
            description: "Published when PDF generation completes"
          }
        }

        subscribes: {
          "payment-events": {
            payload: "PaymentEvent"
            description: "Payment completion events to update invoice status"
          }
        }
      }
    }
  }

  compat: {
    kind: "semver"
    breakingRules: [
      "removeField",
      "removeOperation",
      "tightenEnum",
      "changeType"
    ]
  }
}
```

```cue
// Simpler contract example
contracts: {
  workflows: {
    HealthAPI: {
      version: "1.0.0"
      summary: "Health check API"

      operations: {
        health: {
          summary: "Service health check"
          output: {
            type: "object"
            properties: {
              status: {type: "string"}
              timestamp: {type: "string"}
              version: {type: "string"}
            }
            required: ["status"]
          }
          idempotent: true
        }

        ready: {
          summary: "Readiness probe"
          output: {
            type: "object"
            properties: {
              ready: {type: "boolean"}
              checks: {
                type: "object"
                properties: {
                  database: {type: "boolean"}
                  cache:    {type: "boolean"}
                }
              }
            }
            required: ["ready"]
          }
          idempotent: true
        }
      }
    }
  }
}
```

---

## Deployment

Defines environment-specific deployment configuration including target platform, services, infrastructure, observability, and security settings.

### Schema

```cue
#Deployment: {
  target: "kubernetes" | "aws" | "gcp" | "azure"  // Deployment target platform
  services?: {[Service=string]: #ServiceDeploymentOverride}  // Per-service overrides

  ingress?: {
    [Name=string]: #Ingress                       // Named ingress resources
  }

  testing?: {
    artifacts?: [...("compose" | "docker" | "vagrant")]  // Local testing artifacts
    localDevelopment?: bool | *true               // Enable local dev mode
  }

  cluster?: {
    name:      string                             // Cluster name
    provider:  "kubernetes" | "eks" | "gke" | "aks"  // Kubernetes provider
    context?:  string                             // kubectl context
    namespace?: string                            // Default namespace
    config?:   {...}                              // Provider-specific config
  }

  compose?: {
    version?:     "3.8" | "3.9"                   // Docker Compose version
    networks?:    {[string]: {...}}               // Compose networks
    volumes?:     {[string]: {...}}               // Compose volumes
    profiles?:    [...string]                     // Compose profiles
    environment?: {[string]: string}              // Global environment vars
  }

  strategies?: {
    blueGreen?: bool                              // Enable blue/green deployments
    canary?:    bool                              // Enable canary deployments
    rolling?:   bool                              // Enable rolling updates
    recreate?:  bool                              // Use recreate strategy
  }

  observability?: {
    logs?: {
      level?:  "debug" | "info" | "warn" | "error" | *"info"  // Log level
      schema?: string                             // Structured logging schema
    }
    metrics?: {
      counters?:       [...string]                // Counter metric names
      gauges?:         [...string]                // Gauge metric names
      latencyBuckets?: [...int]                   // Histogram buckets (ms)
    }
    tracing?: {
      sampler?: "always" | "ratio"                // Trace sampling strategy
      ratio?:   number | *0.1                     // Sample ratio (0.0-1.0)
    }
    slos?: [...{
      name:         string                        // SLO name
      indicator:    string                        // SLI metric
      objective:    string                        // Target (e.g., "99.9%")
      window:       string                        // Time window
      alertPolicy?: string                        // Alert policy reference
    }]
  }

  security?: {
    auth?: {
      mode:     "jwt" | "oidc" | "mTLS"           // Authentication mode
      issuers?: [...string]                       // Trusted token issuers
      scopes?:  [...string]                       // Required scopes
    }
    serviceAcl?: [...{
      from:        string                         // Source service
      to:          string                         // Target service
      contractRef: string                         // Allowed contract
    }]
    dataClassifications?: {
      [path=string]: "public" | "internal" | "confidential" | "restricted"
    }
  }

  autoscaling?: {
    hpa?:  {...}                                  // Horizontal Pod Autoscaler config
    keda?: {...}                                  // KEDA autoscaling config
  }

  mesh?: {
    provider: "istio" | "linkerd"                 // Service mesh provider
  }
}
```

### Field Details

**`target`** (required)
: Target deployment platform. Determines which generators and templates are used for infrastructure code.

**`services`** (optional)
: Per-service deployment overrides. Keys match service names from `arbiterSpec.services`. Allows environment-specific customization of replicas, resources, config, etc.

**`ingress`** (optional)
: Named ingress resources for external traffic routing. Typically includes TLS configuration and path-based routing.

**`cluster`** (optional)
: Kubernetes cluster configuration. Required for `target: "kubernetes"` deployments.

**`compose`** (optional)
: Docker Compose configuration for local development. Generated when `testing.artifacts` includes `"compose"`.

**`strategies`** (optional)
: Deployment strategy configuration. Enables advanced deployment patterns like blue/green or canary releases.

**`observability.logs`** (optional)
: Logging configuration including level and structured logging schema.

**`observability.metrics`** (optional)
: Metrics configuration. Specifies which metrics to collect and histogram buckets for latency tracking.

**`observability.tracing`** (optional)
: Distributed tracing configuration. Controls sampling strategy and rate.

**`observability.slos`** (optional)
: Service Level Objectives. Defines SLIs, targets, and alert policies.

**`security.auth`** (optional)
: Authentication configuration applied to all services unless overridden.

**`security.serviceAcl`** (optional)
: Service-to-service access control list. Defines which services can call which contracts.

**`security.dataClassifications`** (optional)
: Data classification labels for compliance and security policies. Maps API paths to classification levels.

**`autoscaling`** (optional)
: Autoscaling configuration using Kubernetes HPA or KEDA.

**`mesh`** (optional)
: Service mesh integration. Enables mTLS, traffic management, and observability features.

### Example

```cue
deployments: {
  // Local development environment
  development: {
    target: "compose"
    compose: {
      version: "3.9"
      networks: {
        app-network: {
          driver: "bridge"
        }
      }
      volumes: {
        postgres-data: {}
        redis-data: {}
      }
      profiles: ["dev", "debug"]
    }

    testing: {
      artifacts: ["compose", "docker"]
      localDevelopment: true
    }

    services: {
      InvoiceAPI: {
        replicas: 1
        env: {
          LOG_LEVEL:    "debug"
          DATABASE_URL: "postgres://postgres:postgres@postgres:5432/invoices"
          REDIS_URL:    "redis://redis:6379"
        }
        resources: {
          requests: {cpu: "100m", memory: "256Mi"}
          limits:   {cpu: "500m", memory: "512Mi"}
        }
      }
    }

    observability: {
      logs: {
        level: "debug"
      }
      tracing: {
        sampler: "always"  // Trace everything in dev
      }
    }
  }

  // Staging environment
  staging: {
    target: "kubernetes"
    cluster: {
      name:      "staging-cluster"
      provider:  "eks"
      namespace: "invoice-staging"
      context:   "arn:aws:eks:us-east-1:123456789:cluster/staging"
    }

    ingress: {
      main: {
        host: "api-staging.example.com"
        tls: {
          secretName: "tls-staging"
          issuer:     "letsencrypt-staging"
        }
        paths: {
          "/api/invoices": {
            serviceName: "InvoiceAPI"
            servicePort: 3000
          }
          "/api/payments": {
            serviceName: "PaymentAPI"
            servicePort: 3000
          }
        }
      }
    }

    services: {
      InvoiceAPI: {
        replicas: 2
        env: {
          LOG_LEVEL: "info"
        }
        resources: {
          requests: {cpu: "250m", memory: "512Mi"}
          limits:   {cpu: "1000m", memory: "1Gi"}
        }
      }
      InvoiceDatabase: {
        resource: {
          size: "db.t3.medium"
          backup: {
            enabled:       true
            retentionDays: 7
          }
        }
      }
    }

    observability: {
      logs: {
        level:  "info"
        schema: "json"
      }
      metrics: {
        counters: [
          "http_requests_total",
          "invoice_created_total",
          "invoice_errors_total"
        ]
        gauges: [
          "active_connections",
          "database_pool_size"
        ]
        latencyBuckets: [10, 25, 50, 100, 250, 500, 1000, 2500]
      }
      tracing: {
        sampler: "ratio"
        ratio:   0.1  // 10% sampling
      }
    }

    security: {
      auth: {
        mode: "jwt"
        issuers: [
          "https://auth-staging.example.com"
        ]
        scopes: ["invoice:read", "invoice:write"]
      }
    }

    strategies: {
      rolling: true
    }
  }

  // Production environment
  production: {
    target: "kubernetes"
    cluster: {
      name:      "prod-cluster"
      provider:  "eks"
      namespace: "invoice-prod"
      context:   "arn:aws:eks:us-east-1:123456789:cluster/prod"
    }

    ingress: {
      main: {
        host: "api.example.com"
        tls: {
          secretName: "tls-prod"
          issuer:     "letsencrypt-prod"
        }
        paths: {
          "/api/invoices": {
            serviceName: "InvoiceAPI"
            servicePort: 3000
          }
        }
      }
    }

    services: {
      InvoiceAPI: {
        replicas: 6
        env: {
          LOG_LEVEL: "warn"
        }
        resources: {
          requests: {cpu: "500m", memory: "1Gi"}
          limits:   {cpu: "2000m", memory: "2Gi"}
        }
        healthCheck: {
          path:     "/health"
          interval: "10s"
          timeout:  "3s"
          retries:  3
        }
      }
      InvoiceDatabase: {
        resource: {
          size: "db.m6i.2xlarge"
          tier: "production"
          backup: {
            enabled:       true
            retentionDays: 30
            window:        "02:00-04:00 UTC"
            multiRegion:   true
          }
          maintenance: {
            window: "sun:05:00-sun:07:00 UTC"
          }
        }
      }
    }

    observability: {
      logs: {
        level:  "warn"
        schema: "json"
      }
      metrics: {
        counters: [
          "http_requests_total",
          "invoice_created_total",
          "invoice_errors_total",
          "invoice_status_transitions_total"
        ]
        gauges: [
          "active_connections",
          "database_pool_size",
          "cache_hit_rate"
        ]
        latencyBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
      }
      tracing: {
        sampler: "ratio"
        ratio:   0.05  // 5% sampling in production
      }
      slos: [{
        name:       "api-availability"
        indicator:  "http_requests_total{status=~'2..|3..'} / http_requests_total"
        objective:  "99.9%"
        window:     "30d"
        alertPolicy: "page-oncall"
      }, {
        name:       "api-latency"
        indicator:  "http_request_duration_seconds"
        objective:  "p95 < 200ms"
        window:     "30d"
        alertPolicy: "page-oncall"
      }]
    }

    security: {
      auth: {
        mode: "jwt"
        issuers: [
          "https://auth.example.com"
        ]
        scopes: ["invoice:read", "invoice:write"]
      }
      serviceAcl: [
        {
          from:        "APIGateway"
          to:          "InvoiceAPI"
          contractRef: "contracts.workflows.InvoiceAPI"
        },
        {
          from:        "InvoiceAPI"
          to:          "PaymentAPI"
          contractRef: "contracts.workflows.PaymentAPI"
        }
      ]
      dataClassifications: {
        "/api/invoices":          "confidential"
        "/api/invoices/*/pdf":    "confidential"
        "/api/health":            "public"
        "/metrics":               "internal"
      }
    }

    autoscaling: {
      hpa: {
        minReplicas: 6
        maxReplicas: 20
        metrics: [
          {
            type: "Resource"
            resource: {
              name: "cpu"
              target: {
                type:               "Utilization"
                averageUtilization: 70
              }
            }
          },
          {
            type: "Resource"
            resource: {
              name: "memory"
              target: {
                type:               "Utilization"
                averageUtilization: 80
              }
            }
          }
        ]
      }
    }

    strategies: {
      canary:    true
      blueGreen: false
      rolling:   false
    }

    mesh: {
      provider: "istio"
    }
  }
}
```

---

## Codegen

Controls code generation determinism, template selection, and artifact fingerprinting to enable reproducible builds and compatibility tracking.

### Schema

```cue
#Codegen: {
  profile:          string                        // Generation profile (maps language×capabilities→templates)
  generator:        string                        // Generator version (e.g., "arbiter/gen@1.6.2")
  templateHash:     string                        // SHA256 hash of template bundle
  componentIdSeed?: string                        // Stable seed for deterministic component IDs
  artifactDigests?: {
    contractsBundle?:  string                     // Digest of generated contract bundle
    schemaBundle?:     string                     // Digest of generated schema bundle
    renderedScaffold?: string                     // Digest of generated scaffold
    migrations?:       string                     // Digest of migration files
  }
  compat?: #CompatPolicy                          // Compatibility policy
}
```

### Field Details

**`profile`** (required)
: Generation profile that maps language, capabilities, and target platform to specific templates and layouts. Format: `<language>-<framework>-<database>-<target>@<version>`. Examples:
  - `"ts-fastify-postgres-k8s@1"`
  - `"python-fastapi-postgres-compose@1"`
  - `"rust-axum-postgres-k8s@2"`

**`generator`** (required)
: Generator tool and version. Format: `<tool>@<version>`. Used to ensure consistent code generation across team members and CI/CD pipelines.

**`templateHash`** (required)
: SHA256 hash of the template bundle used for generation. Enables verification that generated code matches the templates, detecting drift or tampering.

**`componentIdSeed`** (optional)
: Stable random seed for generating deterministic component IDs (UUIDs, resource names, etc.). When set, regenerating from the same spec produces identical IDs. Useful for:
  - Stable database migration ordering
  - Consistent resource naming in Kubernetes
  - Reproducible test fixtures

**`artifactDigests`** (optional)
: Computed digests of generated artifacts. Automatically updated by the generator after successful generation. Used for:
  - Detecting manual changes to generated files
  - Triggering regeneration in CI/CD
  - Verifying reproducibility across environments

**`compat`** (optional)
: Compatibility policy reference. Typically inherited from `contracts.compat` but can be overridden here for stricter rules.

### Example

```cue
codegen: {
  profile:      "ts-fastify-postgres-k8s@1"
  generator:    "arbiter/gen@1.6.2"
  templateHash: "sha256:a3f2b8c1d9e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0"

  componentIdSeed: "invoice-system-2024"

  artifactDigests: {
    contractsBundle:  "sha256:1234567890abcdef..."
    schemaBundle:     "sha256:abcdef1234567890..."
    renderedScaffold: "sha256:fedcba0987654321..."
    migrations:       "sha256:0123456789abcdef..."
  }

  compat: {
    kind: "semver"
    breakingRules: [
      "removeField",
      "removeOperation",
      "tightenEnum",
      "changeType"
    ]
  }
}
```

```cue
// Python project with FastAPI
codegen: {
  profile:      "python-fastapi-postgres-compose@1"
  generator:    "arbiter/gen@1.6.2"
  templateHash: "sha256:b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3"
}
```

```cue
// Rust project with strict compatibility
codegen: {
  profile:      "rust-axum-postgres-k8s@2"
  generator:    "arbiter/gen@2.0.0"
  templateHash: "sha256:c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4"

  compat: {
    kind: "semver"
    breakingRules: [
      "removeField",
      "removeOperation",
      "removeEventType",
      "tightenEnum",
      "changeType",
      "removeEndpoint",
      "changeFieldNullability"
    ]
  }
}
```

---

## Validation Rules

Arbiter enforces the following validation rules to ensure spec consistency and enable safe code generation:

### 1. Binding Completeness

**Rule**: All references must resolve to valid definitions.

- Every `capability.contractRef` must reference an existing `contracts.workflows.<Interface>`
- Every `implements.apis` entry must reference a `contracts.workflows.<Interface>`
- Every `publishes`/`subscribes` channel must exist in the contract's `messages` section
- Schema references (strings in contracts) must resolve to `domain.entities`, `domain.valueObjects`, or `contracts.schemas`

**Example violation**:
```cue
services: {
  API: {
    implements: {
      apis: ["NonExistentContract"]  // ❌ No such contract defined
    }
  }
}
```

**Fix**:
```cue
contracts: {
  workflows: {
    NonExistentContract: {  // ✅ Define the contract
      version: "1.0.0"
      operations: {...}
    }
  }
}
```

### 2. Domain Referential Integrity

**Rule**: Schema references must point to defined entities, value objects, or schemas.

**Example violation**:
```cue
contracts: {
  workflows: {
    API: {
      operations: {
        get: {
          output: "UndefinedEntity"  // ❌ No such entity
        }
      }
    }
  }
}
```

**Fix**:
```cue
domain: {
  entities: {
    UndefinedEntity: {  // ✅ Define the entity
      fields: {...}
    }
  }
}
```

### 3. Ownership Clarity

**Rule**: Each entity can have only one primary owner unless explicitly marked as shared.

**Example violation**:
```cue
services: {
  Service1: {
    implements: {
      models: ["User"]  // ❌ User owned by both services
    }
  }
  Service2: {
    implements: {
      models: ["User"]
    }
  }
}
```

**Fix (option 1 - single owner)**:
```cue
services: {
  Service1: {
    implements: {
      models: ["User"]  // ✅ Only one owner
    }
  }
  Service2: {
    // Service2 can read User but doesn't own it
  }
}
```

**Fix (option 2 - explicit sharing)**:
```cue
domain: {
  entities: {
    User: {
      shared: true  // ✅ Explicitly mark as shared
      fields: {...}
    }
  }
}
```

### 4. Compatibility Gates

**Rule**: Breaking changes require version bumps or migration allowances.

Changes flagged by `codegen.compat.breakingRules` require:
- `meta.version` semver bump (major version for breaking changes)
- OR a `migrations` block with `allowBreak: true`

**Breaking change types**:
- `removeField` - Removing a field from an entity or contract
- `removeOperation` - Removing an API operation
- `tightenEnum` - Restricting enum values
- `changeType` - Changing a field type
- `removeEndpoint` - Removing an HTTP endpoint
- `removeEventType` - Removing an event type

**Example violation**:
```cue
// Version 1.0.0
contracts: {
  workflows: {
    API: {
      version: "1.0.0"
      operations: {
        get: {...}
        delete: {...}  // Removing this later breaks compatibility
      }
    }
  }
}

// Version still 1.0.0 - ❌ Breaking change without version bump
contracts: {
  workflows: {
    API: {
      version: "1.0.0"  // Should be "2.0.0"
      operations: {
        get: {...}
        // delete removed
      }
    }
  }
}
```

**Fix**:
```cue
meta: {
  version: "2.0.0"  // ✅ Major version bump for breaking change
}

contracts: {
  workflows: {
    API: {
      version: "2.0.0"
      operations: {
        get: {...}
      }
    }
  }
}
```

### 5. Determinism Requirements

**Rule**: For full codegen, profile + generator + templateHash must be present.

**Example violation**:
```cue
codegen: {
  profile: "ts-fastify-postgres-k8s@1"
  // ❌ Missing generator and templateHash
}
```

**Fix**:
```cue
codegen: {
  profile:      "ts-fastify-postgres-k8s@1"
  generator:    "arbiter/gen@1.6.2"
  templateHash: "sha256:abc123..."
}
```

### 6. Typed Config

**Rule**: Required config values must be satisfied per environment.

**Example violation**:
```cue
services: {
  API: {
    config: {
      environment: {
        DATABASE_URL: {
          value:    ""  // ❌ Empty but required
          required: true
        }
      }
    }
  }
}
```

**Fix (deployment override)**:
```cue
deployments: {
  production: {
    services: {
      API: {
        env: {
          DATABASE_URL: "postgres://..."  // ✅ Provide in deployment
        }
      }
    }
  }
}
```

### 7. State Machine Soundness

**Rule**: State machines must be well-formed.

- All transitions reference valid states
- `initial` is a member of `states`
- Guards/actions are declared in stubs manifest (if used)

**Example violation**:
```cue
domain: {
  stateMachines: {
    Invoice: {
      states: ["draft", "pending", "paid"]
      initial: "created"  // ❌ "created" not in states
      transitions: [{
        from: "draft"
        to:   "cancelled"  // ❌ "cancelled" not in states
      }]
    }
  }
}
```

**Fix**:
```cue
domain: {
  stateMachines: {
    Invoice: {
      states: ["draft", "pending", "paid", "cancelled"]  // ✅ Include all states
      initial: "draft"  // ✅ Valid initial state
      transitions: [{
        from: "draft"
        to:   "pending"
      }, {
        from: "draft"
        to:   "cancelled"
      }, {
        from: "pending"
        to:   "paid"
      }]
    }
  }
}
```

---

## ValueObject

Represents an immutable data structure without identity. Value objects are compared by their attributes rather than identity, making them ideal for money, addresses, coordinates, and other value-based concepts.

### Schema

```cue
#ValueObject: {
  fields: {[FieldName=string]: #Field}       // Field definitions (same as Entity)
}
```

### Field Details

**`fields`** (required)
: Map of field definitions using the same `#Field` schema as entities. The key difference from entities is that value objects:
  - Have no primary key or identity
  - Are immutable (changes create new instances)
  - Are compared by value equality
  - Cannot be referenced by other entities (must be embedded or serialized)

### Example

```cue
// Money value object
domain: {
  valueObjects: {
    Money: {
      fields: {
        amount: {
          type:        "decimal"
          description: "Monetary amount"
          validators: [{
            name:    "min:0"
            message: "Amount cannot be negative"
          }]
        }
        currency: {
          type:        "string"
          description: "ISO 4217 currency code"
          validators: [{
            name:    "regex:^[A-Z]{3}$"
            message: "Must be 3-letter uppercase currency code"
          }]
        }
      }
    }
  }
}
```

```cue
// Address value object
domain: {
  valueObjects: {
    Address: {
      fields: {
        street: {
          type:        "string"
          description: "Street address"
        }
        city: {
          type:        "string"
          description: "City name"
        }
        state: {
          type:        "string"
          optional:    true
          description: "State/province code"
        }
        postalCode: {
          type:        "string"
          description: "Postal/ZIP code"
        }
        country: {
          type:        "string"
          description: "ISO 3166-1 alpha-2 country code"
          validators: [{
            name: "regex:^[A-Z]{2}$"
          }]
        }
      }
    }
  }
}
```

```cue
// DateRange value object
domain: {
  valueObjects: {
    DateRange: {
      fields: {
        startDate: {
          type:        "timestamp"
          description: "Range start date (inclusive)"
        }
        endDate: {
          type:        "timestamp"
          description: "Range end date (inclusive)"
        }
      }
    }
  }
}
```

---

## Field

Defines a single field within an entity or value object, including type, constraints, relations, and validation rules.

### Schema

```cue
#ScalarType: "string" | "text" | "int" | "float" | "bool" | "uuid" | "timestamp" | "json" | "decimal"

#Field: {
  type:        #ScalarType | "relation"     // Field data type
  description?: string                      // Field description (documentation)
  optional?:    bool | *false               // Whether field can be null/undefined
  primaryKey?:  bool | *false               // Mark as primary key component
  unique?:      bool | *false               // Add unique constraint
  default?:     string | int | bool | number // Default value
  relation?: {
    to:       string                        // Target entity name
    kind:     "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"
    onDelete: "cascade" | "set null" | "restrict" | *"restrict"  // Deletion behavior
  }
  validators?: [...#Validator]              // Field validation rules
}
```

### Field Details

**`type`** (required)
: Field data type. Scalar types map to database and language-specific types:
  - `"string"`: Variable-length text (VARCHAR)
  - `"text"`: Long-form text (TEXT)
  - `"int"`: Integer number (INT/INTEGER)
  - `"float"`: Floating-point number (FLOAT/DOUBLE)
  - `"bool"`: Boolean (BOOLEAN)
  - `"uuid"`: Universally unique identifier (UUID)
  - `"timestamp"`: Date and time (TIMESTAMP/DATETIME)
  - `"json"`: JSON data (JSONB in Postgres, JSON in others)
  - `"decimal"`: Fixed-precision decimal (DECIMAL/NUMERIC)
  - `"relation"`: Foreign key reference to another entity

**`description`** (optional)
: Human-readable field description. Used in generated documentation, database comments, and code comments.

**`optional`** (optional, default: false)
: Whether the field can be null or undefined. When false, the field is required on entity creation.

**`primaryKey`** (optional, default: false)
: Mark this field as part of the primary key. For composite keys, mark multiple fields or use the entity's `keys` array.

**`unique`** (optional, default: false)
: Add a unique constraint to this field. Commonly used for email addresses, usernames, external IDs, etc.

**`default`** (optional)
: Default value when field is not provided. Can be a literal value or a special function like `"now()"` for timestamps.

**`relation`** (optional, required when `type: "relation"`)
: Defines a relationship to another entity:
  - `to`: Target entity name
  - `kind`: Relationship cardinality
  - `onDelete`: Behavior when referenced entity is deleted

**`validators`** (optional)
: Array of validation rules applied before persistence. See [Validator](#validator).

### Example

```cue
// String field with validation
email: {
  type:        "string"
  unique:      true
  description: "User email address (unique)"
  validators: [{
    name:    "email"
    message: "Must be a valid email address"
  }, {
    name:    "maxLen:255"
    message: "Email must not exceed 255 characters"
  }]
}
```

```cue
// UUID primary key with default
id: {
  type:        "uuid"
  primaryKey:  true
  default:     "uuid_generate_v4()"
  description: "Unique entity identifier"
}
```

```cue
// Timestamp with automatic default
createdAt: {
  type:        "timestamp"
  default:     "now()"
  description: "Record creation timestamp"
}
```

```cue
// Optional text field
notes: {
  type:        "text"
  optional:    true
  description: "Optional user notes"
}
```

```cue
// Many-to-one relation with cascade delete
userId: {
  type:        "relation"
  description: "User who owns this post"
  relation: {
    to:       "User"
    kind:     "many-to-one"
    onDelete: "cascade"  // Delete posts when user is deleted
  }
}
```

```cue
// Decimal field with min/max validation
price: {
  type:        "decimal"
  description: "Product price"
  validators: [{
    name:    "min:0.01"
    message: "Price must be at least 0.01"
  }, {
    name:    "max:999999.99"
    message: "Price cannot exceed 999,999.99"
  }]
}
```

---

## Validator

Defines a validation rule applied to a field, enforced before persistence and in generated API code.

### Schema

```cue
#Validator: {
  name:     string          // Validator name and optional parameters (e.g., "email", "minLen:3")
  message?: string          // Custom error message
}
```

### Field Details

**`name`** (required)
: Validator name with optional parameters. Format: `<name>[:<params>]`. Common validators:
  - `"email"` - Valid email address
  - `"url"` - Valid URL
  - `"uuid"` - Valid UUID format
  - `"minLen:N"` - Minimum string length
  - `"maxLen:N"` - Maximum string length
  - `"min:N"` - Minimum numeric value
  - `"max:N"` - Maximum numeric value
  - `"regex:PATTERN"` - Regular expression match
  - `"enum:val1,val2,val3"` - Allowed values
  - `"date"` - Valid date format
  - `"alphanumeric"` - Only letters and numbers
  - `"phone"` - Phone number format

**`message`** (optional)
: Custom validation error message. If omitted, a default message is generated based on the validator name.

### Example

```cue
// Email validation
validators: [{
  name:    "email"
  message: "Must be a valid email address"
}]
```

```cue
// String length constraints
validators: [{
  name:    "minLen:3"
  message: "Must be at least 3 characters"
}, {
  name:    "maxLen:100"
  message: "Must not exceed 100 characters"
}]
```

```cue
// Numeric range
validators: [{
  name:    "min:0"
  message: "Cannot be negative"
}, {
  name:    "max:100"
  message: "Cannot exceed 100"
}]
```

```cue
// Enum validation
validators: [{
  name:    "enum:draft,pending,active,archived"
  message: "Status must be one of: draft, pending, active, archived"
}]
```

```cue
// Regex pattern
validators: [{
  name:    "regex:^[A-Z]{2}[0-9]{6}$"
  message: "Must be 2 uppercase letters followed by 6 digits"
}]
```

```cue
// Multiple validators
validators: [
  {name: "alphanumeric"},
  {name: "minLen:5"},
  {name: "maxLen:20"}
]
```

---

## Index

Defines a database index for query performance optimization.

### Schema

```cue
#Index: {
  name?:   string           // Index name (optional, auto-generated if omitted)
  fields:  [...string]      // Field names to index
  unique?: bool | *false    // Create unique index
}
```

### Field Details

**`name`** (optional)
: Index name. If omitted, Arbiter generates a name from the entity and field names (e.g., `idx_user_email`).

**`fields`** (required)
: List of field names to include in the index. Order matters for composite indexes - most selective fields should come first.

**`unique`** (optional, default: false)
: Whether to create a unique index. Unique indexes enforce that the combination of indexed fields is unique across all rows.

### Example

```cue
// Single-column index
indexes: [{
  name:   "idx_user_email"
  fields: ["email"]
  unique: true
}]
```

```cue
// Composite index for common query
indexes: [{
  name:   "idx_invoice_customer_status"
  fields: ["customerId", "status"]
}]
```

```cue
// Multiple indexes
indexes: [
  {
    fields: ["email"]
    unique: true
  },
  {
    fields: ["createdAt"]
  },
  {
    fields: ["tenantId", "resourceId"]
    unique: true
  }
]
```

```cue
// Index for full-text search optimization
indexes: [{
  name:   "idx_product_search"
  fields: ["name", "description"]
}]
```

---

## DomainEvent

Represents a significant business event that has occurred in the domain, used for event sourcing, audit trails, and inter-service communication.

### Schema

```cue
#DomainEvent: {
  payload: string | #SchemaDef    // Event data (entity/VO reference or inline schema)
}
```

### Field Details

**`payload`** (required)
: Event payload definition. Can be:
  - String reference to an entity: `"Invoice"`
  - String reference to a value object: `"InvoiceLineItem"`
  - Inline `#SchemaDef` object with full schema definition

### Example

```cue
// Event referencing an entity
domain: {
  events: {
    InvoiceCreated: {
      payload: "Invoice"  // Reference to domain.entities.Invoice
    }
  }
}
```

```cue
// Event with inline schema
domain: {
  events: {
    InvoiceStatusChanged: {
      payload: {
        type: "object"
        properties: {
          invoiceId: {type: "string"}
          previousStatus: {type: "string"}
          newStatus: {type: "string"}
          changedBy: {type: "string"}
          changedAt: {type: "string"}
          reason: {type: "string", nullable: true}
        }
        required: ["invoiceId", "previousStatus", "newStatus", "changedBy", "changedAt"]
      }
    }
  }
}
```

```cue
// Multiple domain events
domain: {
  events: {
    UserRegistered: {
      payload: {
        type: "object"
        properties: {
          userId: {type: "string"}
          email: {type: "string"}
          registeredAt: {type: "string"}
          source: {type: "string"}
        }
        required: ["userId", "email", "registeredAt"]
      }
    }

    UserEmailVerified: {
      payload: {
        type: "object"
        properties: {
          userId: {type: "string"}
          email: {type: "string"}
          verifiedAt: {type: "string"}
        }
        required: ["userId", "email", "verifiedAt"]
      }
    }

    UserDeleted: {
      payload: {
        type: "object"
        properties: {
          userId: {type: "string"}
          deletedAt: {type: "string"}
          deletedBy: {type: "string"}
        }
        required: ["userId", "deletedAt"]
      }
    }
  }
}
```

---

## StateMachine

Defines valid states and transitions for an entity, enforcing business rules and workflow constraints at the schema level.

### Schema

```cue
#StateMachine: {
  states: [...string]                  // Valid states
  initial: string                      // Initial state
  transitions: [...{
    from:        string                // Source state
    to:          string                // Target state
    guard?:      string                // Optional guard condition name
    action?:     string                // Optional side-effect action name
    idempotent?: bool | *true          // Whether transition is idempotent
  }]
}
```

### Field Details

**`states`** (required)
: List of all valid states the entity can be in. Each state should be a lowercase string describing a business state.

**`initial`** (required)
: The state new entities start in. Must be one of the values in `states`.

**`transitions`** (required)
: List of allowed state transitions. Each transition defines:
  - `from`: Source state (must be in `states`)
  - `to`: Target state (must be in `states`)
  - `guard`: Optional guard function name that determines if transition is allowed
  - `action`: Optional side-effect function name executed during transition
  - `idempotent`: Whether applying the same transition multiple times is safe

### Example

```cue
// Invoice state machine
domain: {
  stateMachines: {
    Invoice: {
      states: ["draft", "pending", "paid", "cancelled", "refunded"]
      initial: "draft"
      transitions: [
        {
          from:       "draft"
          to:         "pending"
          action:     "calculateTotals"
          idempotent: false
        },
        {
          from:       "draft"
          to:         "cancelled"
          idempotent: true
        },
        {
          from:       "pending"
          to:         "paid"
          action:     "recordPayment"
          guard:      "hasValidPaymentMethod"
          idempotent: true
        },
        {
          from:       "pending"
          to:         "cancelled"
          action:     "releaseInventory"
          idempotent: true
        },
        {
          from:       "paid"
          to:         "refunded"
          action:     "processRefund"
          guard:      "isRefundable"
          idempotent: false
        }
      ]
    }
  }
}
```

```cue
// Order fulfillment state machine
domain: {
  stateMachines: {
    Order: {
      states: ["received", "confirmed", "processing", "shipped", "delivered", "returned"]
      initial: "received"
      transitions: [
        {
          from:   "received"
          to:     "confirmed"
          guard:  "inventoryAvailable"
          action: "reserveInventory"
        },
        {
          from:   "confirmed"
          to:     "processing"
          action: "startFulfillment"
        },
        {
          from:   "processing"
          to:     "shipped"
          action: "generateTrackingNumber"
        },
        {
          from:   "shipped"
          to:     "delivered"
          action: "notifyCustomer"
        },
        {
          from:       "delivered"
          to:         "returned"
          guard:      "withinReturnWindow"
          action:     "initiateReturn"
          idempotent: false
        }
      ]
    }
  }
}
```

```cue
// Simple approval workflow
domain: {
  stateMachines: {
    Document: {
      states: ["draft", "submitted", "approved", "rejected"]
      initial: "draft"
      transitions: [
        {
          from: "draft"
          to:   "submitted"
        },
        {
          from:  "submitted"
          to:    "approved"
          guard: "hasApproverPermission"
        },
        {
          from:  "submitted"
          to:    "rejected"
          guard: "hasApproverPermission"
        },
        {
          from: "rejected"
          to:   "draft"  // Allow resubmission
        }
      ]
    }
  }
}
```

---

## SchemaDef

Defines an inline JSON Schema-compatible object schema for use in contracts and events.

### Schema

```cue
#SchemaDef: {
  type: "object"                                // Always "object" for schema definitions
  properties: {[k=string]: {
    type:      "string" | "number" | "integer" | "boolean" | "object" | "array"  // Property type
    nullable?: bool | *false                    // Allow null values
    items?:    _|_ | {type: string}            // Array item type (if type is "array")
  }}
  required?:    [...string]                     // Required property names
  description?: string                          // Schema description
}
```

### Field Details

**`type`** (required)
: Must be `"object"` for schema definitions.

**`properties`** (required)
: Map of property definitions. Keys are property names, values are property schemas with:
  - `type`: JSON type (string, number, integer, boolean, object, array)
  - `nullable`: Whether null is an allowed value
  - `items`: For array types, defines the type of array elements

**`required`** (optional)
: List of required property names. Properties not in this list are optional.

**`description`** (optional)
: Human-readable schema description.

### Example

```cue
// Simple inline schema
{
  type: "object"
  properties: {
    id:    {type: "string"}
    name:  {type: "string"}
    email: {type: "string"}
    age:   {type: "integer", nullable: true}
  }
  required: ["id", "name", "email"]
  description: "User profile data"
}
```

```cue
// Schema with nested array
{
  type: "object"
  properties: {
    orderId: {type: "string"}
    items: {
      type:  "array"
      items: {type: "object"}
    }
    total: {type: "number"}
  }
  required: ["orderId", "items", "total"]
}
```

```cue
// Reusable schema in contracts
contracts: {
  schemas: {
    ErrorResponse: {
      type: "object"
      properties: {
        code:    {type: "string"}
        message: {type: "string"}
        details: {type: "object", nullable: true}
      }
      required: ["code", "message"]
      description: "Standard error response format"
    }

    PaginatedResponse: {
      type: "object"
      properties: {
        items:  {type: "array", items: {type: "object"}}
        total:  {type: "integer"}
        limit:  {type: "integer"}
        offset: {type: "integer"}
      }
      required: ["items", "total"]
      description: "Paginated list response"
    }
  }
}
```

---

## Message

Defines an event message for pub/sub communication, specifying payload schema and documentation.

### Schema

```cue
#Message: {
  payload:      #SchemaDef | string     // Message payload (inline schema or reference)
  description?: string                  // Message description
}
```

### Field Details

**`payload`** (required)
: Message payload definition. Can be:
  - Inline `#SchemaDef` object
  - String reference to a domain entity, value object, or event

**`description`** (optional)
: Human-readable description of when and why this message is published.

### Example

```cue
// Message referencing domain event
messages: {
  publishes: {
    "user-events": {
      payload:     "UserRegistered"  // Reference to domain.events.UserRegistered
      description: "Published when a new user completes registration"
    }
  }
}
```

```cue
// Message with inline schema
messages: {
  publishes: {
    "notification-events": {
      payload: {
        type: "object"
        properties: {
          userId:      {type: "string"}
          title:       {type: "string"}
          body:        {type: "string"}
          channel:     {type: "string"}
          scheduledAt: {type: "string", nullable: true}
        }
        required: ["userId", "title", "body", "channel"]
      }
      description: "Published when a notification needs to be sent"
    }
  }
}
```

```cue
// Pub/sub contract
contracts: {
  workflows: {
    PaymentEvents: {
      version: "1.0.0"

      messages: {
        publishes: {
          "payment-completed": {
            payload: {
              type: "object"
              properties: {
                paymentId:  {type: "string"}
                orderId:    {type: "string"}
                amount:     {type: "number"}
                currency:   {type: "string"}
                completedAt: {type: "string"}
              }
              required: ["paymentId", "orderId", "amount", "currency", "completedAt"]
            }
            description: "Published when payment is successfully processed"
          }

          "payment-failed": {
            payload: {
              type: "object"
              properties: {
                paymentId: {type: "string"}
                orderId:   {type: "string"}
                reason:    {type: "string"}
                failedAt:  {type: "string"}
              }
              required: ["paymentId", "orderId", "reason", "failedAt"]
            }
            description: "Published when payment processing fails"
          }
        }

        subscribes: {
          "order-events": {
            payload: "OrderCreated"
            description: "Listens for new orders to initiate payment"
          }
        }
      }
    }
  }
}
```

---

## CompatPolicy

Defines compatibility rules for detecting breaking changes in contracts and enforcing version management.

### Schema

```cue
#CompatPolicy: {
  kind:          "semver" | *"semver"                                            // Versioning scheme
  breakingRules?: [..."removeField", "tightenEnum", "changeType", "removeEndpoint", "removeEventType"]  // Breaking change types to detect
}
```

### Field Details

**`kind`** (required, default: "semver")
: Versioning scheme to use. Currently only `"semver"` is supported, which enforces semantic versioning rules.

**`breakingRules`** (optional)
: List of change types considered breaking. When detected, they trigger validation errors unless accompanied by a major version bump. Supported values:
  - `"removeField"` - Removing a field from an entity or schema
  - `"removeOperation"` - Removing an operation from a contract
  - `"tightenEnum"` - Reducing allowed enum values
  - `"changeType"` - Changing a field's data type
  - `"removeEndpoint"` - Removing an HTTP endpoint
  - `"removeEventType"` - Removing a domain event type

### Example

```cue
// Strict compatibility policy
contracts: {
  compat: {
    kind: "semver"
    breakingRules: [
      "removeField",
      "removeOperation",
      "tightenEnum",
      "changeType",
      "removeEndpoint",
      "removeEventType"
    ]
  }
}
```

```cue
// Lenient policy (only track removals)
contracts: {
  compat: {
    kind: "semver"
    breakingRules: [
      "removeField",
      "removeOperation",
      "removeEventType"
    ]
  }
}
```

```cue
// Default policy (minimal checks)
contracts: {
  compat: {
    kind: "semver"
  }
}
```

---

## ServiceDependency

Defines a dependency relationship between services, allowing explicit declaration of required services, databases, caches, queues, and external APIs.

### Schema

```cue
#ServiceDependency: {
  name?:        string                 // Dependency identifier (optional for legacy specs)
  type?:        string                 // Dependency bucket type (service, database, cache, queue, external)
  target?:      string                 // Referenced service/resource name
  version?:     string                 // Semver constraint (e.g., ">=15", "^1.2.0")
  kind?:        string                 // Specific technology (postgres, redis, envoy)
  optional?:    bool | *false          // Whether dependency is required
  contractRef?: string                 // Contract reference (e.g., "contracts.workflows.InvoiceAPI")
  description?: string                 // Dependency description
}
```

### Field Details

**`name`** (optional)
: Dependency identifier within the service. Used for named connections or references in generated code.

**`type`** (optional)
: Dependency type bucket. Helps organize dependencies by category (service, database, cache, queue, external).

**`target`** (optional)
: Name of the referenced service or resource from `arbiterSpec.services`.

**`version`** (optional)
: Version constraint using semver notation:
  - `">=15"` - Minimum version 15
  - `"^1.2.0"` - Compatible with 1.2.0 (>=1.2.0, <2.0.0)
  - `"~1.2.3"` - Patch-level changes (>=1.2.3, <1.3.0)
  - `"1.2.3"` - Exact version

**`kind`** (optional)
: Specific technology or engine type. Examples: `"postgres"`, `"redis"`, `"rabbitmq"`, `"envoy"`, `"elasticsearch"`.

**`optional`** (optional, default: false)
: Whether the service can start without this dependency. Optional dependencies typically provide enhanced functionality but aren't required for core operations.

**`contractRef`** (optional)
: Reference to the contract this dependency implements. Format: `"contracts.workflows.<ContractName>"`. Used for type-safe client generation.

**`description`** (optional)
: Human-readable description of why this dependency exists and how it's used.

### Example

```cue
// Service dependencies
dependencies: {
  services: [{
    name:        "payment-service"
    target:      "PaymentAPI"
    contractRef: "contracts.workflows.PaymentAPI"
    version:     "^2.0.0"
    description: "Payment processing service for order completion"
  }]
}
```

```cue
// Database dependency
dependencies: {
  databases: [{
    name:    "primary-db"
    target:  "PostgresDB"
    kind:    "postgres"
    version: ">=15"
  }]
}
```

```cue
// Multiple dependency types
dependencies: {
  services: [{
    target:      "AuthService"
    contractRef: "contracts.workflows.AuthAPI"
  }]

  databases: [{
    target:  "UserDB"
    kind:    "postgres"
    version: ">=14"
  }]

  caches: [{
    target:   "SessionCache"
    kind:     "redis"
    version:  ">=7"
    optional: true  // App works without cache, just slower
  }]

  queues: [{
    target: "EventQueue"
    kind:   "nats"
  }]

  external: [{
    name:        "stripe-api"
    contractRef: "contracts.workflows.StripeAPI"
    version:     "2024-01-01"
    description: "Stripe payment gateway"
  }]
}
```

---

## Capability

Defines a service capability, specifying how it exposes functionality (HTTP server, queue consumer, cron job, etc.) and which contract it implements.

### Schema

```cue
#Capability: {
  kind:        "httpServer" | "rpcServer" | "queueConsumer" | "cronJob" | "worker" | "cli"  // Capability type
  contractRef?: string                        // Contract reference
  adapter?: {
    name:     string                          // Framework/adapter name
    version?: string                          // Adapter version
    options?: {...}                           // Adapter-specific options
  }
  features?: {
    auth?: {
      mode:    "jwt" | "oidc" | "mTLS"        // Authentication mode
      scopes?: [...string]                    // Required scopes
    }
    rateLimit?: {
      requestsPerSec: int                     // Requests per second limit
      burst?:         int                     // Burst capacity
    }
    cors?: {
      origins: [...string]                    // Allowed origins
    }
    compression?: bool | *true                // Enable response compression
    middlewares?: [...string]                 // Middleware references
  }
  schedule?: string                           // Cron expression (for cronJob)
}
```

### Field Details

**`kind`** (required)
: Capability type:
  - `"httpServer"` - REST/HTTP API server
  - `"rpcServer"` - gRPC or other RPC server
  - `"queueConsumer"` - Message queue consumer
  - `"cronJob"` - Scheduled task
  - `"worker"` - Background worker
  - `"cli"` - Command-line interface

**`contractRef`** (optional)
: Reference to the contract this capability implements. Format: `"contracts.workflows.<ContractName>"`.

**`adapter`** (optional)
: Framework adapter configuration:
  - `name`: Framework name (fastify, express, fastapi, axum, gin, etc.)
  - `version`: Framework version constraint
  - `options`: Framework-specific configuration

**`features.auth`** (optional)
: Authentication configuration:
  - `mode`: Authentication mechanism
  - `scopes`: Required authorization scopes

**`features.rateLimit`** (optional)
: Rate limiting configuration to prevent abuse and ensure fair resource allocation.

**`features.cors`** (optional)
: Cross-Origin Resource Sharing configuration for web clients.

**`features.compression`** (optional, default: true)
: Whether to compress HTTP responses (gzip, brotli).

**`features.middlewares`** (optional)
: List of middleware names to apply to all requests.

**`schedule`** (optional, required for cronJob)
: Cron expression defining the schedule (e.g., `"0 9 * * *"` for daily at 9 AM).

### Example

```cue
// HTTP server capability
capabilities: [{
  kind:        "httpServer"
  contractRef: "contracts.workflows.InvoiceAPI"
  adapter: {
    name:    "fastify"
    version: "4.x"
    options: {
      logger: true
      trustProxy: true
    }
  }
  features: {
    auth: {
      mode:   "jwt"
      scopes: ["invoice:read", "invoice:write"]
    }
    rateLimit: {
      requestsPerSec: 100
      burst:          20
    }
    cors: {
      origins: [
        "https://app.example.com",
        "https://admin.example.com"
      ]
    }
    compression: true
  }
}]
```

```cue
// Queue consumer capability
capabilities: [{
  kind:        "queueConsumer"
  contractRef: "contracts.workflows.OrderEvents"
  adapter: {
    name: "nats"
    version: "2.x"
    options: {
      durableName: "order-processor"
      maxAckPending: 100
    }
  }
}]
```

```cue
// Cron job capability
capabilities: [{
  kind:     "cronJob"
  schedule: "0 2 * * *"  // Daily at 2 AM
  adapter: {
    name: "node-cron"
  }
}]
```

```cue
// Multiple capabilities (HTTP + worker)
capabilities: [
  {
    kind:        "httpServer"
    contractRef: "contracts.workflows.UserAPI"
    adapter: {name: "fastify"}
  },
  {
    kind:        "worker"
    contractRef: "contracts.workflows.BackgroundJobs"
    adapter: {name: "bullmq"}
  }
]
```

---

## ServiceEndpoint

Defines a named HTTP endpoint with path, methods, handler, and middleware configuration. Enables explicit routing and handler references.

### Schema

```cue
#ServiceEndpoint: {
  description?: string                    // Endpoint description
  path:         string                    // Canonical path owned by this service
  methods:      [...string]               // HTTP methods (GET, POST, PUT, DELETE, etc.)
  handler:      #HandlerRef               // Handler reference (module or endpoint)
  implements:   string                    // Contract operation reference
  middleware?:  [...#MiddlewareRef]       // Middleware stack
}
```

### Field Details

**`description`** (optional)
: Human-readable endpoint description.

**`path`** (required)
: Canonical URL path for this endpoint. May include path parameters (e.g., `"/invoices/{id}"`).

**`methods`** (required)
: List of HTTP methods this endpoint handles. Common values: `["GET"]`, `["POST"]`, `["GET", "HEAD"]`, `["PUT", "PATCH"]`.

**`handler`** (required)
: Handler reference. See [HandlerRef](#handlerref).

**`implements`** (required)
: Contract operation this endpoint implements. Format: `"contracts.workflows.<Contract>.operations.<Operation>"`.

**`middleware`** (optional)
: Ordered list of middleware to apply to requests. Executed in array order.

### Example

```cue
// Simple GET endpoint
endpoints: {
  getInvoice: {
    description: "Retrieve invoice by ID"
    path:        "/invoices/{id}"
    methods:     ["GET", "HEAD"]
    handler: {
      type:     "module"
      module:   "./handlers/get-invoice.ts"
      function: "handler"
    }
    implements: "contracts.workflows.InvoiceAPI.operations.getInvoice"
  }
}
```

```cue
// Endpoint with middleware
endpoints: {
  createInvoice: {
    path:    "/invoices"
    methods: ["POST"]
    handler: {
      type:     "module"
      module:   "./handlers/create-invoice.ts"
      function: "createHandler"
    }
    implements: "contracts.workflows.InvoiceAPI.operations.createInvoice"
    middleware: [
      {
        module:   "./middleware/validate-schema.ts"
        function: "validateInvoice"
        phase:    "request"
      },
      {
        module:   "./middleware/audit.ts"
        function: "auditLog"
        phase:    "both"
      }
    ]
  }
}
```

```cue
// Gateway endpoint referencing another service's endpoint
endpoints: {
  publicInvoiceAPI: {
    path:    "/api/invoices/{id}"
    methods: ["GET"]
    handler: {
      type:     "endpoint"
      service:  "InvoiceService"
      endpoint: "getInvoice"
    }
    implements: "contracts.workflows.InvoiceAPI.operations.getInvoice"
    middleware: [{
      module:   "./middleware/auth.ts"
      function: "requireAuth"
      phase:    "request"
    }]
  }
}
```

---

## HandlerRef

References a request handler, either as a module/function pair or as another service's endpoint. Enables flexible routing and service composition.

### Schema

```cue
#HandlerRef: #ModuleHandlerRef | #EndpointHandlerRef

#ModuleHandlerRef: {
  type:      *"module"               // Handler type (default)
  module?:   string                  // Module path (optional, can be inferred)
  function?: string                  // Function name (optional, defaults to "handler")
}

#EndpointHandlerRef: {
  type:     "endpoint"               // Reference another service's endpoint
  service:  string                   // Service name
  endpoint: string                   // Endpoint key within that service
}
```

### Field Details

**Module Handler:**

**`type`** (default: "module")
: Handler type. Use `"module"` for local handlers.

**`module`** (optional)
: Path to module file. When omitted, Arbiter derives the path from project structure and endpoint name.

**`function`** (optional, default: "handler")
: Exported function name. Defaults to `"handler"`.

**Endpoint Handler:**

**`type`** (required: "endpoint")
: Handler type for endpoint references.

**`service`** (required)
: Name of the service that owns the endpoint.

**`endpoint`** (required)
: Endpoint key within that service's `endpoints` map.

### Example

```cue
// Module handler with explicit paths
handler: {
  type:     "module"
  module:   "./services/invoice/handlers/get-invoice.ts"
  function: "getInvoiceHandler"
}
```

```cue
// Module handler with defaults (Arbiter infers paths)
handler: {
  type: "module"
}
```

```cue
// Endpoint reference (gateway pattern)
handler: {
  type:     "endpoint"
  service:  "InvoiceService"
  endpoint: "getInvoice"
}
```

---

## MiddlewareRef

References middleware functions that intercept and process requests/responses, enabling cross-cutting concerns like authentication, logging, and validation.

### Schema

```cue
#MiddlewareRef: {
  name?:     string                              // Middleware name (for reference)
  module?:   string                              // Module path (optional)
  function?: string                              // Function name (optional)
  phase?:    "request" | "response" | "both" | *"request"  // Execution phase
  config?:   {...}                               // Middleware configuration
}
```

### Field Details

**`name`** (optional)
: Middleware identifier for debugging and logging.

**`module`** (optional)
: Path to middleware module. When omitted, Arbiter derives from project structure and middleware name.

**`function`** (optional)
: Exported function name. Defaults to module's default export.

**`phase`** (optional, default: "request")
: When to execute the middleware:
  - `"request"` - Before handler execution
  - `"response"` - After handler execution
  - `"both"` - Both before and after

**`config`** (optional)
: Middleware-specific configuration object passed to the middleware function.

### Example

```cue
// Request phase middleware (authentication)
middleware: [{
  name:     "auth"
  module:   "./middleware/auth.ts"
  function: "requireAuth"
  phase:    "request"
  config: {
    scopes: ["invoice:read"]
  }
}]
```

```cue
// Response phase middleware (caching)
middleware: [{
  name:   "cache"
  module: "./middleware/cache.ts"
  phase:  "response"
  config: {
    ttl: 300
    key: "invoice:{id}"
  }
}]
```

```cue
// Both phases middleware (logging)
middleware: [{
  name:   "audit"
  module: "./middleware/audit.ts"
  phase:  "both"
  config: {
    logRequests:  true
    logResponses: true
    redact: ["password", "token"]
  }
}]
```

```cue
// Multiple middleware (execution order)
middleware: [
  {
    module:   "./middleware/cors.ts"
    phase:    "request"
  },
  {
    module:   "./middleware/auth.ts"
    phase:    "request"
  },
  {
    module:   "./middleware/validate.ts"
    phase:    "request"
  },
  {
    module:   "./middleware/compress.ts"
    phase:    "response"
  }
]
```

---

## HealthCheck

Defines health check configuration for service liveness and readiness probes, critical for reliable deployments in Kubernetes and other orchestration platforms.

### Schema

```cue
#HealthCheck: {
  path:      string                   // Health check endpoint path
  interval?: string | *"30s"          // Check interval
  timeout?:  string | *"10s"          // Request timeout
  retries?:  int & >=1 | *3          // Failure retries before marking unhealthy
}
```

### Field Details

**`path`** (required)
: HTTP endpoint path for health checks (e.g., `"/health"`, `"/healthz"`).

**`interval`** (optional, default: "30s")
: Time between health checks. Format: `"<number><unit>"` where unit is `s` (seconds), `m` (minutes), or `h` (hours).

**`timeout`** (optional, default: "10s")
: Maximum time to wait for health check response before considering it failed.

**`retries`** (optional, default: 3)
: Number of consecutive failures before marking the service as unhealthy.

### Example

```cue
// Standard health check
healthCheck: {
  path:     "/health"
  interval: "30s"
  timeout:  "10s"
  retries:  3
}
```

```cue
// Aggressive health check (fast failure detection)
healthCheck: {
  path:     "/healthz"
  interval: "5s"
  timeout:  "2s"
  retries:  2
}
```

```cue
// Conservative health check (tolerant of slow responses)
healthCheck: {
  path:     "/health"
  interval: "60s"
  timeout:  "30s"
  retries:  5
}
```

---

## ServiceConfig

Defines service configuration including environment variables, configuration files, and secrets management.

### Schema

```cue
#ServiceConfig: {
  environment?: {[string]: #ConfigValue}    // Environment variables
  files?:       [...#ConfigFile]            // Configuration files
  secrets?:     [...#Secret]                // Secret references
}

#ConfigValue: string | {
  value:    string                          // Configuration value
  type?:    "string" | "number" | "boolean" | "json"  // Value type
  required: bool | *false                   // Whether value is required
  default?: string                          // Default value
}

#ConfigFile: {
  source:      string                       // Source file path
  destination: string                       // Destination path in container
  readonly?:   bool | *false                // Mount as read-only
}

#Secret: {
  name:      string                         // Secret name
  key:       string                         // Environment variable key
  value?:    string                         // Literal value (dev only)
  external?: string                         // External secret reference
}
```

### Field Details

**`environment`** (optional)
: Map of environment variable names to values. Values can be simple strings or structured `#ConfigValue` objects.

**`files`** (optional)
: List of configuration files to mount into the service container.

**`secrets`** (optional)
: List of secrets (passwords, API keys, tokens) with secure storage references.

**ConfigValue:**
- `value`: The configuration value
- `type`: Type hint for validation and parsing
- `required`: Whether the value must be provided (fails if missing)
- `default`: Default value if not provided

**ConfigFile:**
- `source`: Path to source file (relative to project root)
- `destination`: Path where file is mounted in container
- `readonly`: Whether file should be read-only

**Secret:**
- `name`: Secret identifier
- `key`: Environment variable name
- `value`: Literal value (use only for development)
- `external`: Reference to external secret manager (AWS Secrets Manager, HashiCorp Vault, etc.)

### Example

```cue
// Environment variables with typing
config: {
  environment: {
    LOG_LEVEL: {
      value:    "info"
      type:     "string"
      default:  "warn"
    }
    PORT: {
      value:    "3000"
      type:     "number"
      required: true
    }
    ENABLE_METRICS: {
      value:   "true"
      type:    "boolean"
      default: "false"
    }
    DATABASE_URL: {
      value:    "postgres://localhost:5432/db"
      required: true
    }
  }
}
```

```cue
// Configuration files
config: {
  files: [{
    source:      "./config/app.yaml"
    destination: "/etc/app/config.yaml"
    readonly:    true
  }, {
    source:      "./config/logging.json"
    destination: "/etc/app/logging.json"
  }]
}
```

```cue
// Secrets management
config: {
  secrets: [{
    name:     "db-password"
    key:      "DATABASE_PASSWORD"
    external: "aws-secrets-manager://prod/invoice/db"
  }, {
    name:     "api-key"
    key:      "STRIPE_API_KEY"
    external: "vault://secret/stripe/api-key"
  }, {
    name:  "jwt-secret"
    key:   "JWT_SECRET"
    value: "dev-secret-only"  // Only for local development
  }]
}
```

```cue
// Complete configuration
config: {
  environment: {
    NODE_ENV:     "production"
    LOG_LEVEL:    "warn"
    PORT:         {value: "3000", type: "number"}
    DATABASE_URL: {value: "", required: true}
  }

  files: [{
    source:      "./config/prod.yaml"
    destination: "/etc/app/config.yaml"
    readonly:    true
  }]

  secrets: [{
    name:     "db-credentials"
    key:      "DATABASE_PASSWORD"
    external: "aws-secrets-manager://prod/db"
  }]
}
```

---

## ResourceRequirements

Defines CPU and memory resource requests and limits for service containers, enabling proper resource allocation and preventing resource exhaustion.

### Schema

```cue
#ResourceRequirements: {
  requests?: {
    cpu?:    string              // CPU request (e.g., "250m", "1")
    memory?: string              // Memory request (e.g., "512Mi", "1Gi")
  }
  limits?: {
    cpu?:    string              // CPU limit
    memory?: string              // Memory limit
  }
}
```

### Field Details

**`requests`** (optional)
: Minimum resources guaranteed to the container. Scheduler uses this for placement decisions.

**`limits`** (optional)
: Maximum resources the container can use. Container is throttled (CPU) or killed (memory) if it exceeds limits.

**CPU format:**
- `"1"` = 1 CPU core
- `"500m"` = 0.5 CPU cores (500 millicores)
- `"250m"` = 0.25 CPU cores

**Memory format:**
- `"512Mi"` = 512 mebibytes (binary)
- `"1Gi"` = 1 gibibyte
- `"500M"` = 500 megabytes (decimal)

### Example

```cue
// Standard web service
resources: {
  requests: {
    cpu:    "250m"
    memory: "512Mi"
  }
  limits: {
    cpu:    "1000m"
    memory: "1Gi"
  }
}
```

```cue
// Memory-intensive batch job
resources: {
  requests: {
    cpu:    "500m"
    memory: "2Gi"
  }
  limits: {
    cpu:    "2000m"
    memory: "4Gi"
  }
}
```

```cue
// Minimal sidecar
resources: {
  requests: {
    cpu:    "100m"
    memory: "128Mi"
  }
  limits: {
    cpu:    "200m"
    memory: "256Mi"
  }
}
```

```cue
// CPU-intensive worker (no memory limit for flexibility)
resources: {
  requests: {
    cpu:    "1000m"
    memory: "512Mi"
  }
  limits: {
    cpu: "4000m"
  }
}
```

---

## Ingress

Defines ingress (external HTTP/HTTPS traffic routing) configuration for exposing services to the internet or internal networks with TLS support.

### Schema

```cue
#Ingress: {
  host:  string                                             // Hostname for the ingress
  tls?:  {
    secretName: string                                      // TLS certificate secret name
    issuer?:    string                                      // Certificate issuer (e.g., letsencrypt)
  }
  paths: {[p=string]: {
    serviceName: string                                     // Target service name
    servicePort: int                                        // Target service port
  }}
}
```

### Field Details

**`host`** (required)
: Fully qualified domain name for the ingress (e.g., `"api.example.com"`, `"app.staging.example.com"`).

**`tls`** (optional)
: TLS/SSL configuration:
  - `secretName`: Kubernetes secret containing the TLS certificate and key
  - `issuer`: Certificate issuer reference for automatic cert generation (cert-manager, letsencrypt-prod, letsencrypt-staging)

**`paths`** (required)
: Map of URL paths to service routing. Keys are path patterns, values are service targets.

### Example

```cue
// Simple HTTP ingress
ingress: {
  main: {
    host: "api.example.com"
    paths: {
      "/": {
        serviceName: "API"
        servicePort: 3000
      }
    }
  }
}
```

```cue
// HTTPS ingress with automatic cert
ingress: {
  secure: {
    host: "api.example.com"
    tls: {
      secretName: "api-tls"
      issuer:     "letsencrypt-prod"
    }
    paths: {
      "/": {
        serviceName: "API"
        servicePort: 3000
      }
    }
  }
}
```

```cue
// Path-based routing
ingress: {
  gateway: {
    host: "services.example.com"
    tls: {
      secretName: "services-tls"
      issuer:     "letsencrypt-prod"
    }
    paths: {
      "/api/invoices": {
        serviceName: "InvoiceService"
        servicePort: 3000
      }
      "/api/payments": {
        serviceName: "PaymentService"
        servicePort: 3000
      }
      "/api/users": {
        serviceName: "UserService"
        servicePort: 3000
      }
    }
  }
}
```

```cue
// Multiple ingress (different domains)
ingress: {
  api: {
    host: "api.example.com"
    tls: {secretName: "api-tls", issuer: "letsencrypt-prod"}
    paths: {
      "/": {serviceName: "API", servicePort: 3000}
    }
  }

  admin: {
    host: "admin.example.com"
    tls: {secretName: "admin-tls", issuer: "letsencrypt-prod"}
    paths: {
      "/": {serviceName: "AdminPanel", servicePort: 8080}
    }
  }

  staging: {
    host: "api-staging.example.com"
    tls: {secretName: "staging-tls", issuer: "letsencrypt-staging"}
    paths: {
      "/": {serviceName: "API", servicePort: 3000}
    }
  }
}
```

---

## Volume

Defines persistent or temporary storage volumes for services, including persistent volume claims, config maps, and secrets.

### Schema

```cue
#Volume: {
  type:          "persistentVolumeClaim" | "configMap" | "secret" | "emptyDir"  // Volume type
  size?:         string                                   // Volume size (for PVC)
  storageClass?: string                                   // Storage class (for PVC)
  accessModes?:  [...string]                              // Access modes (for PVC)
  items?:        [...{
    key:  string                                          // Item key
    path: string                                          // Mount path
    mode?: int                                            // File permissions
  }]
  labels?:       {[string]: string}                       // Kubernetes labels
  annotations?:  {[string]: string}                       // Kubernetes annotations
}
```

### Field Details

**`type`** (required)
: Volume type:
  - `"persistentVolumeClaim"` - Persistent storage (databases, file uploads, etc.)
  - `"configMap"` - Configuration data from Kubernetes ConfigMap
  - `"secret"` - Sensitive data from Kubernetes Secret
  - `"emptyDir"` - Temporary storage (cleared on pod restart)

**`size`** (optional, required for persistentVolumeClaim)
: Volume size (e.g., `"10Gi"`, `"100Gi"`, `"1Ti"`).

**`storageClass`** (optional)
: Storage class name for dynamic provisioning (e.g., `"ssd"`, `"standard"`, `"gp3"`).

**`accessModes`** (optional)
: How the volume can be mounted:
  - `"ReadWriteOnce"` - Single node read/write
  - `"ReadOnlyMany"` - Multiple nodes read-only
  - `"ReadWriteMany"` - Multiple nodes read/write

**`items`** (optional, for configMap/secret)
: Specific items to mount from the configMap or secret.

**`labels`** (optional)
: Kubernetes labels for organization and selection.

**`annotations`** (optional)
: Kubernetes annotations for metadata.

### Example

```cue
// Persistent volume claim
volumes: {
  database-data: {
    type:         "persistentVolumeClaim"
    size:         "100Gi"
    storageClass: "ssd"
    accessModes:  ["ReadWriteOnce"]
    labels: {
      app:       "postgres"
      component: "database"
    }
  }
}
```

```cue
// Config map volume
volumes: {
  app-config: {
    type: "configMap"
    items: [{
      key:  "app.yaml"
      path: "config/app.yaml"
      mode: 0644
    }, {
      key:  "logging.json"
      path: "config/logging.json"
      mode: 0644
    }]
  }
}
```

```cue
// Secret volume
volumes: {
  tls-certs: {
    type: "secret"
    items: [{
      key:  "tls.crt"
      path: "tls/cert.pem"
      mode: 0600
    }, {
      key:  "tls.key"
      path: "tls/key.pem"
      mode: 0600
    }]
  }
}
```

```cue
// Temporary volume
volumes: {
  cache: {
    type: "emptyDir"
    annotations: {
      "description": "Temporary cache directory"
    }
  }
}
```

```cue
// Multiple volumes
volumes: {
  postgres-data: {
    type:         "persistentVolumeClaim"
    size:         "50Gi"
    storageClass: "fast-ssd"
    accessModes:  ["ReadWriteOnce"]
  }

  uploads: {
    type:         "persistentVolumeClaim"
    size:         "200Gi"
    storageClass: "standard"
    accessModes:  ["ReadWriteMany"]
  }

  config: {
    type: "configMap"
  }

  temp: {
    type: "emptyDir"
  }
}
```

---

## Network

Defines network configuration for service communication, typically used in Docker Compose deployments.

### Schema

```cue
#Network: {
  type:     "internal" | "external"       // Network visibility
  driver?:  string                        // Network driver
  options?: {[string]: string}            // Driver-specific options
  labels?:  {[string]: string}            // Network labels
}
```

### Field Details

**`type`** (required)
: Network visibility:
  - `"internal"` - Isolated network for service-to-service communication
  - `"external"` - Network accessible from outside the stack

**`driver`** (optional)
: Network driver type:
  - `"bridge"` - Default driver for single-host networks
  - `"overlay"` - Multi-host networks (Docker Swarm)
  - `"host"` - Use host's network stack
  - `"none"` - No networking

**`options`** (optional)
: Driver-specific configuration options. Varies by driver.

**`labels`** (optional)
: Labels for organization and metadata.

### Example

```cue
// Internal bridge network (default)
networks: {
  app-network: {
    type:   "internal"
    driver: "bridge"
  }
}
```

```cue
// External network (connects to existing network)
networks: {
  shared-network: {
    type: "external"
  }
}
```

```cue
// Network with custom options
networks: {
  backend: {
    type:   "internal"
    driver: "bridge"
    options: {
      "com.docker.network.bridge.name":            "arbiter-backend"
      "com.docker.network.bridge.enable_icc":      "true"
      "com.docker.network.bridge.enable_ip_masquerade": "true"
    }
    labels: {
      environment: "production"
      project:     "arbiter"
    }
  }
}
```

```cue
// Multiple networks (network segmentation)
networks: {
  frontend: {
    type:   "internal"
    driver: "bridge"
    labels: {
      tier: "frontend"
    }
  }

  backend: {
    type:   "internal"
    driver: "bridge"
    labels: {
      tier: "backend"
    }
  }

  database: {
    type:   "internal"
    driver: "bridge"
    options: {
      "com.docker.network.bridge.enable_icc": "false"  // Restrict inter-container communication
    }
    labels: {
      tier:     "database"
      security: "restricted"
    }
  }

  monitoring: {
    type:   "external"
    labels: {
      tier: "monitoring"
    }
  }
}
```

---

## Contributing

When adding new schema entities to this reference:

1. **Add TOC entry** in the Table of Contents under the appropriate category
2. **Create section** with entity name as H2 heading
3. **Brief description** explaining what the entity represents and its purpose
4. **Schema box** with CUE definition including inline comments after each field
5. **Field Details** section with detailed explanation of each field using the `**`field`**` format
6. **Examples** section with at least 2-3 practical examples showing common use cases

This pattern ensures consistency, completeness, and clarity for all schema entity documentation.
