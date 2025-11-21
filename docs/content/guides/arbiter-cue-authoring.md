# Arbiter CUE Authoring Guide

Use this guide when writing or reviewing Arbiter specs. For every field and type, refer to the [schema reference](../reference/arbiter-cue-schema.md); this page keeps the “how to author” guidance separate from the type dump.

## Quick authoring checklist
1. Define `meta` (name, version, repository) and `runtime.language` early.
2. Model domain types using **schemas** with types (Entity, Value, Request, Response, Event) and **state machines** before wiring services.
3. Define schema fields, validation rules, and relationships using **CUE syntax** for type-safe, expressive definitions.
4. Add contracts under `contracts.workflows` with **SLA/Performance requirements** upfront, and define operations/schemas using **CUE syntax**.
5. Declare services in `services.<name>` with `language`, `serviceType`/`workload`, and grouped dependencies (`dependencies.services`, `dependencies.databases`, etc.).
6. Use `deployments.<environment>` for runtime settings; the legacy singular `deployment` key is no longer supported.
7. Lock determinism with `codegen.profile` and `codegen.templateHash` when cutting releases.

## Working with Schemas

Arbiter uses a unified **Schema** concept with five types:
- **Entity**: Business objects with identity (e.g., Invoice, Customer)
- **Value**: Immutable data structures (e.g., Address, Money)
- **Request**: API request payloads
- **Response**: API response payloads
- **Event**: Domain events representing state changes

**Using the CLI/UI:**
- Add schemas with `arbiter add schema` and select the appropriate type
- Define fields, validation rules, and relationships using **CUE syntax**
- All schema fields support CUE's expressive type system for validation

**CUE Syntax Examples:**
```cue
// Fields definition
amount: number
currency: "USD" | "EUR" | "GBP"
customer_id: string
metadata?: {...}

// Validation rules (constraints)
amount > 0
currency: "USD" | "EUR" | "GBP"
customer_id: =~"^[0-9a-f]{8}-[0-9a-f]{4}-"

// Relationships
customer: #Customer
items: [...#LineItem]
```

## Working with Contracts

Contracts define how systems communicate. When defining contracts:

1. **Specify SLA/Performance requirements early** for visibility (e.g., "p95 < 200ms, uptime 99.9%")
2. **Version contracts** for compatibility tracking
3. **Define operations using CUE syntax** for type-safe operation definitions
4. **Use CUE for request/response schemas** to ensure consistency

**Field Order:**
1. Name
2. SLA/Performance
3. Version
4. Operations (CUE syntax)
5. Request Schema (CUE syntax)
6. Response Schema (CUE syntax)
7. Description (markdown)

## Compatibility notes
- **`deployment` vs `deployments`:** Use `deployments.<env>` only; the singular `deployment` key has been removed.
- **Schema evolution:** Breaking changes should bump `meta.version` and add compatibility details under `contracts.compat`.
- **Overrides:** Per-service overrides beat global runtime defaults; keep overrides minimal to reduce drift between services.
- **Schema types:** Use the unified Schema concept with type selection rather than treating entities/valueObjects as completely separate domain concepts.

## Validation & tooling
- Validate locally with `arbiter validate <file.cue>` before running `arbiter generate`.
- The template context generator (`packages/cli/src/templates/index.ts`) serializes your spec directly; inspect that JSON (see Template Development Guide) if a template misunderstands your data.

## Reference
The full type list (e.g., `#Service`, `#Deployment`, `#Runtime`) lives in the [schema reference](../reference/arbiter-cue-schema.md). Regenerate docs via `bun run docs:cue` when the schema changes.
