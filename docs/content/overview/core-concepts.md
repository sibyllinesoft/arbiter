# Core Concepts

**A single system where everyone on the team contributes to software creation**

Traditional software development forces constant translation: product managers write roadmaps, which become tickets, which become code, which becomes infrastructure. Each handoff loses context and introduces drift.

Arbiter takes a different approach. Instead of separate artifacts that must be manually synchronized, you build a single specification that *is* the product definition, the technical design, and the deployment configuration—all in one place. The layered architecture lets each team member work at their natural level of abstraction while their contributions compose seamlessly into the final system.

- **Product owners** define domain models and business processes
- **Architects** design contracts and capability boundaries
- **Engineers** implement services that fulfill those contracts
- **Platform teams** configure execution environments

No one has to translate another team's work into their own format. Arbiter handles the translation, generating exactly what each layer needs from the shared specification.

> Looking for hands-on examples? Pair this explainer with the
> [Code Generation Overview](./code-generation-overview.md), which applies the
> same layers step-by-step using the CLI.

| Layer | Who Owns It | What They Define | What Gets Generated |
| --- | --- | --- | --- |
| **Domain** | Product / Domain Experts | Data models, statuses, business rules | DB schemas, validators, types, test fixtures |
| **Contracts** | Architects / Tech Leads | APIs, events, SLAs | OpenAPI specs, SDKs, contract tests |
| **Capabilities** | Engineers | Services, endpoints, handlers | Application code, routes, middleware |
| **Execution** | Platform / DevOps | Environments, scaling, resources | Docker, Kubernetes, Terraform, CI/CD |

## One Tool, One Source of Truth

Everyone on the team uses Arbiter. There's a single specification that captures business requirements, technical design, and deployment configuration. When anyone makes a change, `arbiter generate` produces the artifacts that used to require manual work.

| Traditional Process | What Arbiter Replaces It With |
| --- | --- |
| Write PRDs describing data and rules | Typed schemas that *generate* database tables, validators, and API types |
| Write API spec documents | Contracts that *generate* OpenAPI specs, client SDKs, and request validation |
| Manually write boilerplate code | Scaffolding generated from the spec (you write the business logic) |
| Craft infrastructure configs by hand | IaC files inferred from service definitions and environment config |
| Maintain separate documentation | Docs generated from the spec, always in sync |

The spec doesn't replace where these artifacts live—your code still goes in GitHub, your docs can still go in Notion if policy requires it. What changes is *how* they're created. Instead of manually crafting each artifact and keeping them in sync, you define the intent once and generate the rest.

---

## Layer 1: Domain

The **Domain** layer is where product owners and domain experts define *what the business cares about*—using the same terms they already use in meetings and documents.

### What You Define → What Gets Generated

| You Define (PM/PO terms) | Arbiter Generates |
| --- | --- |
| **Data models** — What things exist? (Order, Customer, Invoice) | Database tables, API types, validation schemas |
| **Fields and types** — What properties do they have? (order.total, customer.email) | Column definitions, TypeScript interfaces, Pydantic models |
| **Statuses** — What states can things be in? (draft → submitted → fulfilled) | Enum types, status transition validators, audit trails |
| **Business rules** — What constraints apply? (total ≥ 0, email must be valid) | Database constraints, runtime validators, error messages |
| **Acceptance criteria** — How should it behave? (Given/When/Then) | Automated test suites, living documentation |

### Example: Defining an Order

A product owner describes an Order in plain terms:

> "An Order has a customer, line items, and a total. It starts as a draft, then gets submitted, then fulfilled. The total must be positive."

In Arbiter, this becomes:

```bash
arbiter add schema Order \
  --fields "customerId:string, status:enum(draft,submitted,fulfilled), total:number" \
  --rules "total >= 0"
```

From that single definition:
- Frontend gets `Order` types in TypeScript with full autocomplete
- Backend gets models, validation logic, and API boilerplate pre-generated
- The database gets an `orders` table with the right columns and constraints
- QA gets test fixtures with valid and invalid order examples
- Docs get an always-current data dictionary

No one asks "what are the valid order statuses?" — the spec answers that question for everyone.

### Capturing the Domain

- **Whiteboard first, then encode**: Run sessions with stakeholders, then use `arbiter add schema` to formalize what you discussed
- **Use familiar terms**: Name things the way the business talks about them
- **Write acceptance criteria**: Define Given/When/Then scenarios that become both documentation and executable tests

> See the [Code Generation Overview](./code-generation-overview.md#layer-1--domain-describe-the-schema) for a complete walkthrough.

---

## Layer 2: Contracts

The **Contracts** layer is where architects and tech leads define *how systems talk to each other*—the APIs and events that bind services together.

### What You Define → What Gets Generated

| You Define | Arbiter Generates |
| --- | --- |
| **Operation contracts** (CreateOrder, GetInvoice) | OpenAPI specs, client SDKs, request/response validation |
| **Event contracts** (OrderCreated, PaymentFailed) | Message schemas, typed event classes |

### Types of Contracts

- **Operation contracts** describe request/response workflows. Services bind them to HTTP, gRPC, or queues by referencing the operation ID.
- **Event contracts** capture async messages—who emits them, who subscribes, and the schema guarantees for each event.

Use the CLI (`arbiter add contract`, `arbiter add contract-operation`, `arbiter add event`) to author contracts so identifiers stay consistent.

An architect defines a `CreateOrder` operation referencing the domain's `Order` schema. From that:
- Frontend gets type-safe API clients
- Backend knows exactly what to implement (and gets validation for free)
- QA gets contract tests
- Docs get auto-generated API references

> See [Layer 2 in the Code Generation Overview](./code-generation-overview.md#layer-2--contracts-bind-the-operations) for a complete walkthrough.

## Layer 3: Capabilities

The **Capabilities** layer is where engineers define *what services exist*—specifying which contracts they implement and what dependencies they need.

### What You Define → What Gets Generated

| You Define | Arbiter Generates |
| --- | --- |
| **Services** (OrdersAPI, PaymentProcessor) | Application scaffolds with typed stubs for your business logic |
| **Services with type** (postgres, redis, rabbitmq) | Container definitions, connection configuration, health checks |
| **Endpoints** (/orders, /invoices/{id}) | Route definitions, request validation, response serialization |

Databases, caches, and queues are just services with an additional `type` field. There are convenience commands (`arbiter add database`, `arbiter add cache`) but they all create service entries. The Execution layer determines where and how each service runs.

### What This Makes Easier

When you run `arbiter add service orders-api --language python --template fastapi`:

- You get typed API stubs using the contracts defined by architects
- Request/response types come from schemas defined by product owners
- Baseline tests verify the API matches its contract
- You write the business logic; Arbiter handles the boilerplate

The spec ensures the API matches its contract and uses the right types. You're not manually wiring validation or copying type definitions between layers.

### Service Definition

- **Add application services** with `arbiter add service <name>`—language, template, and source directory
- **Add infrastructure services** with `arbiter add database <name>` or `arbiter add cache <name>` (these create services with the appropriate type)
- **Declare endpoints** via `arbiter add endpoint ... --service <name>` linking to contract operations

> See [Layer 3 in the Code Generation Overview](./code-generation-overview.md#layer-3--capabilities-compose-services) for a complete example.

---

## Layer 4: Execution

The **Execution** layer is where platform and DevOps teams define *where and how services run*—taking the services defined in Capabilities and configuring their deployment.

### What You Define → What Gets Generated

| You Define | Arbiter Generates |
| --- | --- |
| **Environments** (dev, staging, prod) | Docker Compose files, Kubernetes manifests, Terraform configs |
| **Deployment targets** (local, cloud, managed) | Container definitions, connection strings, resource provisioning |
| **Scaling rules** (replicas, resources) | HPA configs, resource limits, autoscaling policies |
| **CI/CD pipelines** | GitHub Actions, GitLab CI, deployment workflows |

### What This Makes Easier

Platform teams don't configure each service independently. Update the spec to add an environment or change scaling rules, and IaC files generate automatically using shared configuration.

A platform engineer defines `environments.production` with Kubernetes as the target and 3 replicas for the orders service. From that:

- Engineers get a local dev environment that mirrors production
- CI/CD pipelines deploy to the right place with the right config
- Everyone can see exactly what runs where

No more "production has different env vars" surprises. The spec defines all environments.

### Environment Configuration

- **Describe environments declaratively**: `environments.development`, `environments.production`, etc.
- **Model shared infrastructure as services** with `type: "external"` and resource metadata
- **Keep overrides co-located**: scaling, feature flags, and ingress belong in the spec, not scattered YAML

Use the CLI: `arbiter add database`, `arbiter add cache`, and `arbiter sync` manage the structure.

> For a full manifest example, see
> [Layer 4 in the Code Generation Overview](./code-generation-overview.md#layer-4--execution-generate-and-run).

## Guided Walkthrough: From Idea to Running Service

1. **Capture intent** – extend the Domain layer with the next InvoicePro concept (for example, `UsageBasedBilling`) and its events in one PR.
2. **Expose collaboration points** – add HTTP/event contracts that describe how finance, collections, and analytics teams consume the billing data.
3. **Define execution ownership** – introduce a `BillingService` capability, wire it to contracts, declare its dependencies (databases, caches) as services, and describe the env-specific overrides in `environments`.
4. **Generate and review** – run `arbiter generate --dry-run` to see code, docs, and deployment manifests that all reflect the spec, then merge when stakeholders sign off.

Following this loop turns the layered model into a tutorial every new InvoicePro product slice can follow.

---

## Key Benefits: Why This Works for Teams

### 1. **Everyone Contributes Directly**

Product owners define schemas that become real database tables. Architects design contracts that become real APIs. No one waits for developers to "translate" their work—it flows directly into the system.

### 2. **No More Translation Overhead**

Traditional process: roadmap → PRD → tickets → code → deployment config → docs. Each step loses context.

Arbiter process: one spec that *is* all of those things. Change the spec, regenerate, and everything updates together.

### 3. **Work Composes Seamlessly**

A PM adds a field to a schema. An architect adds an endpoint that uses it. An engineer implements the handler. A platform engineer scales the service. Each person works independently, but their changes compose into a coherent system.

### 4. **Mistakes Surface Early**

Breaking changes are caught when the spec is modified, not when code is deployed. Schema constraints are validated before code is generated. Contract mismatches are detected before integration testing.

### 5. **New Team Members Onboard Fast**

The spec documents *what* the system does, *why* decisions were made, and *how* everything fits together. New engineers read one artifact instead of piecing together tribal knowledge from Slack threads and outdated wikis.

### 6. **Technology Choices Stay Flexible**

The spec is independent of specific frameworks, databases, or cloud providers. Swap PostgreSQL for MySQL, FastAPI for Django, or AWS for GCP—the domain and contracts stay the same.

---

## Working with Specifications

### Creating a New Specification

1. **Start with Domain**: Define your core business entities and rules
2. **Add Contracts**: Specify how systems will communicate
3. **Define Capabilities**: Declare what services will do
4. **Configure Execution**: Specify environments, environment overrides, and service dependencies

### Iterative Development

Let the CLI mutate the spec so identifiers, metadata, and docs stay in sync. Drop to a text editor only when reconciling brownfield repos or performing bulk refactors that the CLI does not yet support.

```bash
# Apply spec changes via the CLI (preferred)
arbiter add service InvoiceService --template fastify
arbiter add endpoint InvoiceService --service InvoiceService --path /api/invoices/{invoiceId}

# Only edit the CUE directly when reconciling brownfield changes
# vim .arbiter/assembly.cue

# Validate changes
arbiter check

# Preview what will be generated
arbiter generate --dry-run

# Generate the code
arbiter generate

# Test the generated system
arbiter integrate --test
```

> **CLI first.** Use the `arbiter add|remove|rename` workflows to evolve the spec. Manual edits should be rare and limited to advanced migrations or brownfield imports.

### Version Management

Arbiter tracks specification versions and enforces compatibility:

```cue
meta: {
  version: "1.2.0"
  previous: "1.1.0"
}

codegen: {
  profile: "production-ready"
  templateHash: "abc123def456"
  compatibility: {
    checkBreakingChanges: true
    requireMigrations: true
  }
}
```

---

## Best Practices

### Model the Spec In Layers

- **Domain First**: capture vocabulary, invariants, and workflows before worrying
  about runtime. Use the unified Schema concept with appropriate types (Entity,
  Value, Request, Response, Event) rather than treating entities and value objects
  as separate constructs. If it isn't in the domain layer, downstream automation
  can't reuse it.
- **Contracts Next**: describe how work flows across the system (operations,
  events, assertions) while staying transport-agnostic. Version the contract and
  document intent inline so future PRs have context. Prioritize SLA/Performance
  requirements upfront for visibility.
- **Capabilities & Services**: bind domain + contracts to implementation details
  (languages, frameworks, endpoints). Keep the spec honest by referencing real
  modules/paths rather than prose.

### Keep Implementations Adaptable

- **Start Stateful in the Spec, Not the Runtime**: express dependencies,
  configs, and service source locations declaratively so you can change the
  actual architecture later without rewriting your spec.
- **Model Environments Explicitly**: use `environments.<env>` to describe how
  each environment overrides replicas, env vars, or ingress. Keeping this in the
  spec prevents drift between dev/stage/prod.
- **Document External Touchpoints**: when referencing APIs, SaaS systems, or
  managed databases, record the canonical URL or contract name in `source`/
  `dependencies` so codegen and tests know who you depend on.

---

## Next Steps

- **[CLI Reference](../reference/cli-reference.md)** - Learn all Arbiter commands
- **[Kubernetes Tutorial](../tutorials/kubernetes/README.md)** - Deploy to
  Kubernetes
- **[Examples](../tutorials/basics/Readme.md)** - Explore real-world specifications
- **[API Documentation](../reference/api/generation-api-reference.md)** - Understand the generated APIs

---

_The four-layer architecture isn't just about organizing code—it's about organizing teams. Each layer has a natural owner, and Arbiter handles the translation between them. Product owners, architects, engineers, and platform teams all contribute to a single specification that becomes the running system. No handoffs, no drift, no lost context._
