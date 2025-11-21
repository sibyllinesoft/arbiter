# Arbiter v1.0.0 Release Notes

**Release Date**: November 21, 2025
**License**: Sibylline Business License (SBL) v1.0

---

## 🎉 Welcome to Arbiter 1.0!

We're excited to announce the first production-ready release of Arbiter - a specification-driven development platform that turns declarative CUE specifications into production-ready code, documentation, and infrastructure.

## 🚀 What is Arbiter?

Arbiter is a complete toolchain for building applications from specifications:

- **Write specs once** in CUE (a powerful configuration language)
- **Generate everything** - code, configs, CI/CD, docs
- **Stay in sync** - specs are the source of truth
- **Brownfield friendly** - import existing projects
- **AI-optimized** - designed for agent/automation workflows

## 📦 Installation

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/arbiter.git
cd arbiter

# Install dependencies (requires Bun)
bun install

# Build the standalone CLI
bun run build:standalone

# Verify installation
./arbiter-cli --version
# arbiter/1.0.0 linux-x64 bun-1.x
```

### Prerequisites

1. **Bun** (v1.0.0 or higher)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **CUE Binary** (v0.9.x or newer) - **REQUIRED**
   ```bash
   # macOS
   brew install cue-lang/tap/cue

   # Linux
   go install cuelang.org/go/cmd/cue@latest

   # Verify
   cue version
   ```

3. **System Requirements**
   - 8GB RAM (recommended)
   - Linux, macOS, or Windows with WSL2

## 🎯 Key Features

### Comprehensive CLI

```bash
# Initialize a new project
./arbiter-cli init my-app

# Add a service
./arbiter-cli add service api --language go

# Generate code
./arbiter-cli generate

# Validate specs
./arbiter-cli check

# Watch for changes
./arbiter-cli watch
```

### Multi-Language Support

Generate production-ready code for:
- ✅ **Go** - net/http, gin, fiber
- ✅ **Python** - FastAPI, Pydantic
- ✅ **Rust** - Axum, Tokio
- ✅ **TypeScript** - Express, NestJS

### Visual Workbench

Launch the web UI to:
- Browse and edit specifications
- Visualize architecture diagrams
- Import projects from GitHub
- Monitor generation status

```bash
# Start API + Client
bun run dev:full

# Open http://localhost:3000
```

### CI/CD Integration

Generate GitHub Actions workflows:

```bash
./arbiter-cli integrate --target github-actions
```

Produces:
- Test workflows
- Build and deploy pipelines
- Version management
- Release automation

## ⚠️ Breaking Changes & Migration

### If You're Upgrading from Pre-Release Versions

#### 1. Deployment Configuration (BREAKING)

**What Changed**: `deployment` (singular) → `deployments` (plural, keyed object)

**Before**:
```cue
// .arbiter/assembly.cue
{
  product: { name: "My App" }
  deployment: {
    target: "kubernetes"
    namespace: "production"
  }
  services: { /* ... */ }
}
```

**After**:
```cue
// .arbiter/assembly.cue
{
  product: { name: "My App" }
  deployments: {
    production: {
      target: "kubernetes"
      namespace: "production"
    }
    staging: {
      target: "kubernetes"
      namespace: "staging"
    }
  }
  services: { /* ... */ }
}
```

**Why**: Support multiple deployment environments in a single spec.

#### 2. Enhanced Dependency System (BACKWARD COMPATIBLE)

**What Changed**: Dependencies can now be grouped and typed.

**Old Format (still works)**:
```cue
services: {
  api: {
    dependencies: {
      postgres: { service: "postgres", version: "15" }
      redis: { service: "redis" }
    }
  }
}
```

**New Format (recommended)**:
```cue
services: {
  api: {
    dependencies: {
      databases: [
        { name: "postgres", type: "database", kind: "postgres", version: "15" }
      ]
      caches: [
        { name: "redis", type: "cache", kind: "redis" }
      ]
    }
  }
}
```

**Why**: Better organization, clearer intent, enables advanced dependency analysis.

**Migration**: No action required - old format still supported. Update at your convenience.

## 🏁 Getting Started Tutorial

### 1. Create Your First Project

```bash
# Initialize
./arbiter-cli init my-api --template rest-api

# Navigate to project
cd my-api

# View the generated spec
cat .arbiter/assembly.cue
```

### 2. Add a Service

```bash
# Add a user service with database
./arbiter-cli add service users \
  --language python \
  --database postgres \
  --routes "GET /users,POST /users,GET /users/:id"
```

### 3. Generate Code

```bash
# Generate all code
./arbiter-cli generate

# See what was created
tree generated/
```

### 4. Validate and Test

```bash
# Check specs
./arbiter-cli check

# Run generated tests
cd generated/users
bun test  # or: pytest, cargo test, go test
```

### 5. Start Development

```bash
# Watch for changes
./arbiter-cli watch &

# Edit specs
vim .arbiter/assembly.cue

# Code regenerates automatically!
```

## 📚 Documentation

- **Getting Started**: `docs/content/index.md`
- **CLI Reference**: `docs/content/reference/cli-reference.md`
- **CUE Authoring**: `docs/content/guides/arbiter-cue-authoring.md`
- **Template Development**: `docs/content/guides/template-development-guide.md`
- **API Reference**: Run `bun run docs:tsdoc`

### Documentation Site

```bash
# Start local docs server
bun run docs:site:dev

# Open http://localhost:8000
```

## 🐛 Known Issues

### Test Environment
- Client tests require DOM setup (we're working on this)
- 549 test failures related to test environment configuration
- Business logic tests pass; UI component tests need jsdom/happy-dom

**Workaround**: Run API and CLI tests separately:
```bash
bun test packages/cli --recursive  # ✅ Pass
bun test apps/api --recursive       # ✅ Pass
# Skip client tests for now
```

### TypeScript Strictness
- Some client components use `@ts-nocheck` due to Monaco editor typing complexity
- CLI package uses relaxed strictness for ergonomics
- No runtime impact; purely development DX issue

### CUE Binary Required
- Must have `cue` on your PATH
- Commands will fail fast if not found
- See installation instructions above

## 🔒 License & Usage

**Sibylline Business License (SBL) v1.0**

### You CAN:
✅ Use for internal/commercial projects
✅ Modify and create derivatives
✅ Distribute modifications
✅ Provide consulting/integration services

### You CANNOT:
❌ Offer competing SaaS (hosted Arbiter-as-a-service)
❌ Remove license/attribution notices

### Commercial Licensing
For SaaS use cases, contact: nathan.alexander.rice@gmail.com

See `LICENSE` file for complete terms.

## 🤝 Contributing

Arbiter is source-available under SBL. Contributions welcome!

### Development Setup

```bash
# Install dependencies
bun install

# Build all packages
bun run build:all

# Run quality checks
bun run quality

# Run tests (excluding client for now)
bun test packages/ apps/api --recursive

# Start dev stack
bun run dev:full
```

### Code Quality Standards

- ✅ Biome linting (zero warnings)
- ✅ Prettier formatting
- ✅ TypeScript compilation
- ✅ All tests passing (per package)

```bash
# Verify before committing
bun run quality
```

## 📞 Support & Community

- **Issues**: https://github.com/your-org/arbiter/issues
- **Discussions**: https://github.com/your-org/arbiter/discussions
- **Documentation**: https://your-org.github.io/arbiter
- **Email**: nathan.alexander.rice@gmail.com

## 🎯 Roadmap

### v1.1 (Q1 2026)
- [ ] Stabilize client test environment
- [ ] Enhanced Python FastAPI templates
- [ ] Kubernetes Helm chart generation
- [ ] OpenAPI 3.1 import support

### v1.2 (Q2 2026)
- [ ] VS Code extension
- [ ] Real-time collaboration
- [ ] Multi-spec projects
- [ ] Enhanced dependency graph visualization

### Future
- [ ] Language Server Protocol (LSP) for CUE
- [ ] Cloud deployment integrations
- [ ] Advanced monitoring/observability generation

## 🙏 Thank You

Thank you for trying Arbiter 1.0! We're excited to see what you build.

For questions, feedback, or just to share what you're working on, please open a GitHub discussion or reach out via email.

---

**Happy Specifying!**
*The Arbiter Team*
