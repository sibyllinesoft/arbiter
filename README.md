# Arbiter

A CUE-based specification validation and management CLI with agent-first automation and comprehensive app modeling.

## Overview

Arbiter is a powerful tool for specifying, validating, and generating applications from declarative CUE specifications. It supports both infrastructure-focused (v1) and app-centric (v2) development approaches.

### Key Features

- **Dual Schema Support**: Both v1 (infrastructure-focused) and v2 (app-centric) specifications
- **Code Generation**: Generate TypeScript, Python, Rust, Go, and Shell projects
- **Flow-Based Testing**: Automated test generation from user flows and locators
- **API Specification**: OpenAPI generation from component schemas and paths
- **UI Component Generation**: React components from route specifications
- **Migration Tools**: Seamless migration from v1 to v2 format

## Schema Formats

### V2 App Specification (Recommended)

The v2 format is app-centric and designed for comprehensive application modeling:

```cue
// Complete application specification
product: {
  name: "Invoice Manager"
  goals: ["Streamline invoice creation", "Automate payment tracking"]
  roles: ["admin", "accountant", "manager"]
  slos: { p95_page_load_ms: 2000, uptime: "99.9%" }
}

// UI routes and capabilities
ui: routes: [
  {
    id: "invoices:list"
    path: "/invoices" 
    capabilities: ["list", "create", "search", "filter"]
    components: ["InvoiceTable", "CreateButton", "SearchBar"]
  },
  {
    id: "invoices:detail"
    path: "/invoices/:id"
    capabilities: ["view", "edit", "delete", "send"]
    components: ["InvoiceForm", "StatusBadge", "ActionButtons"]
  }
]

// Stable test locators
locators: {
  "btn:createInvoice": '[data-testid="create-invoice"]'
  "field:customerName": '[data-testid="customer-name"]'
  "table:invoicesList": '[data-testid="invoices-table"]'
}

// User flows for testing
flows: [
  {
    id: "invoice_creation"
    preconditions: { role: "accountant" }
    steps: [
      { visit: "invoices:list" },
      { click: "btn:createInvoice" },
      { fill: { locator: "field:customerName", value: "Acme Corp" } },
      { expect: { locator: "btn:saveInvoice", state: "enabled" } }
    ]
  }
]

// Component schemas (OpenAPI-like)
components: schemas: {
  Invoice: {
    example: {
      id: "INV-001"
      customer: "Acme Corp"
      total: 1500.00
      status: "draft"
    }
    rules: { total: ">= 0", status: "must be valid enum" }
  }
}

// API paths
paths: {
  "/api/invoices": {
    get: { response: { $ref: "#/components/schemas/Invoice", example: [...] } }
    post: { 
      request: { $ref: "#/components/schemas/Invoice" }
      response: { $ref: "#/components/schemas/Invoice" }
    }
  }
}
```

### V1 Assembly Specification (Legacy)

The v1 format focuses on infrastructure and deployment:

```cue
// Infrastructure-focused specification  
arbiterSpec: {
  config: { 
    language: "typescript"
    kind: "service"
    buildTool: "bun"
  }
  
  metadata: {
    name: "billing-service"
    version: "1.0.0"
    description: "Invoice management service"
  }
  
  services: {
    api: {
      serviceType: "bespoke"
      language: "typescript" 
      ports: [{ name: "http", port: 3000 }]
      env: { DATABASE_URL: "postgres://..." }
    }
    
    database: {
      serviceType: "prebuilt"
      image: "postgres:15"
      ports: [{ name: "pg", port: 5432 }]
    }
  }
  
  deployment: {
    target: "kubernetes"
    cluster: { name: "prod", namespace: "billing" }
  }
}
```

## Getting Started

### Installation

```bash
npm install -g @arbiter/cli
# or
bun install -g @arbiter/cli
```

### Quick Start

1. **Create a new v2 app specification:**

```bash
arbiter init my-app --format=v2
```

2. **Generate application code:**

```bash
arbiter generate
```

3. **Run tests generated from flows:**

```bash
npm test  # Runs Playwright tests generated from flows
```

### Migration from v1 to v2

If you have existing v1 specifications:

```bash
# Preview migration (dry run)
arbiter migrate --dry-run

# Migrate with backup
arbiter migrate --backup

# Generate v2 artifacts  
arbiter generate
```

## Commands

### Core Commands

- **`arbiter generate`** - Generate application code from specifications
- **`arbiter validate`** - Validate CUE specifications
- **`arbiter migrate`** - Migrate v1 specifications to v2 format
- **`arbiter export`** - Export to various formats (OpenAPI, Terraform, etc.)

### Examples

```bash
# Generate with CI workflows
arbiter generate --include-ci

# Dry run to preview generated files
arbiter generate --dry-run

# Export OpenAPI specification
arbiter export --format=openapi

# Validate specification
arbiter validate assembly.cue
```

## Generated Artifacts

### V2 App Generation

From v2 specifications, Arbiter generates:

- **React Components** from UI routes
- **Playwright Tests** from flow specifications  
- **OpenAPI Specs** from component schemas and paths
- **Locator Definitions** for stable UI testing
- **TypeScript Types** from component schemas
- **Project Structure** with modern tooling (Vite, Vitest, etc.)

### V1 Infrastructure Generation

From v1 specifications, Arbiter generates:

- **Language-specific projects** (TypeScript, Python, Rust, Go, Shell)
- **Docker Compose** configurations for local development
- **Kubernetes/Terraform** configurations for deployment
- **CI/CD workflows** (GitHub Actions)
- **Test suites** with intelligent composition

## Examples

See the `examples/` directory for:

- **`app-spec-v2-example.cue`** - Comprehensive v2 app specification
- **`basic.cue`** - Simple v1 assembly example  
- **`kubernetes.cue`** - Advanced Kubernetes deployment
- **`api-schema.cue`** - API-focused specification

## Development

### Prerequisites

- [Node.js](https://nodejs.org) v20+
- [Bun](https://bun.sh) v1.0+
- [CUE](https://cuelang.org) for specification validation

### Building

```bash
bun install
bun run build
```

### Testing

```bash
bun test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## Architecture

Arbiter follows a modular architecture:

- **Schema Detection** - Automatically detects v1 vs v2 format
- **Dual Generators** - Separate generation pipelines for each format
- **Migration Engine** - Converts v1 specifications to v2
- **Template System** - Extensible code generation templates
- **Validation Pipeline** - CUE-based specification validation

## License

MIT License - see `LICENSE` file for details.

## Links

- [Documentation](./docs/)
- [Examples](./examples/)
- [Contributing Guide](./CONTRIBUTING.md)
- [Changelog](./CHANGELOG.md)

To regenerate or modify the structure:

```bash
arbiter generate
```
