# Arbiter

**The agent-first framework for generating reliable, full-stack applications from a single CUE specification.**

[![License](https://img.shields.io/badge/license-LicenseRef--SPL--1.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CUE](https://img.shields.io/badge/CUE-configuration-green)](https://cuelang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)

> **Agent-First Design**: Built from the ground up to work seamlessly with AI agents and automated workflows. Non-interactive commands, structured outputs, and comprehensive APIs make Arbiter the ideal choice for AI-driven development.

## What is Arbiter?

Arbiter is a sophisticated specification validation and code generation framework that transforms a single CUE specification into complete, production-ready applications. Unlike traditional code generators, Arbiter follows a **Domain → Contracts → Capabilities → Execution** architecture that ensures consistency, maintainability, and reliability across your entire stack.

### Key Features

🤖 **Agent-First Architecture**: Designed for AI and automation with non-interactive commands and structured outputs  
📝 **CUE-Powered**: Leverage CUE's type safety and validation for bulletproof specifications  
🏗️ **Full-Stack Generation**: From database schemas to UI components to CI/CD pipelines  
🔄 **Live Validation**: Real-time specification checking with instant feedback  
🎯 **Deterministic Output**: Same specification always generates identical code  
🌐 **Modern Tech Stack**: Built with Bun, TypeScript, React, and cutting-edge tools  

## Quick Start

### Installation

```bash
# Via Bun (recommended)
bun install -g arbiter-cli

# Via NPM
npm install -g arbiter-cli

# Or download the standalone binary from releases
curl -L https://github.com/arbiter-framework/arbiter/releases/latest/download/arbiter-cli > arbiter
chmod +x arbiter
```

### Create Your First Project

```bash
# Initialize a new project in the current directory
mkdir my-app && cd my-app
arbiter init "My Application"

# Add your first component
arbiter add service user-service
arbiter add endpoint POST /users

# Generate the complete application
arbiter generate

# Validate everything is correct
arbiter check
```

### Architecture Overview

Arbiter follows a layered specification approach:

```
Domain Models     ← Pure business logic and data structures
     ↓
Contracts        ← APIs, interfaces, and communication patterns  
     ↓
Capabilities     ← Features, services, and system behaviors
     ↓
Execution        ← Deployment, infrastructure, and runtime
```

This ensures that changes cascade predictably and your generated applications maintain architectural consistency.

## What Gets Generated?

From a single specification, Arbiter can generate:

- **Backend Services**: APIs, database schemas, authentication, authorization
- **Frontend Applications**: React components, pages, routing, state management  
- **Infrastructure**: Docker configs, Kubernetes manifests, CI/CD pipelines
- **Documentation**: API docs, architectural diagrams, runbooks
- **Tests**: Unit, integration, and end-to-end test suites

## Web Interface

Arbiter includes a sophisticated web interface for visual specification editing:

- **Interactive Diagrams**: Visualize your system architecture
- **Real-time Validation**: Instant feedback as you edit specifications
- **Component Browser**: Explore and manage your system components
- **Generation Preview**: See what will be generated before creating files

```bash
# Start the development server
bun run dev

# Open http://localhost:5173 to access the web interface
```

## Project Structure

```
arbiter/
├── apps/
│   ├── api/                 # Backend API server (Bun + TypeScript)
│   └── web/                 # React frontend with Vite
├── packages/
│   ├── cli/                 # Main CLI package
│   └── shared/              # Shared utilities and types
├── examples/                # Example specifications and projects
├── docs/                    # Documentation and guides
└── arbiter-cli              # Standalone CLI binary
```

## Documentation

- **[Getting Started Guide](docs/getting-started.md)** - Complete walkthrough for new users
- **[Core Concepts](docs/core-concepts.md)** - Understanding Arbiter's architecture
- **[CLI Reference](docs/cli-reference.md)** - Complete command documentation
- **[Kubernetes Tutorial](doc/tutorial/kubernetes/README.md)** - Deploy applications to Kubernetes
- **[API Documentation](docs/api.md)** - REST API reference

## Examples

Explore real-world examples in the [`examples/`](examples/) directory:

- **[Basic Web App](examples/basic-web-app/)** - Simple CRUD application
- **[Microservices](examples/microservices/)** - Multi-service architecture
- **[Kubernetes Deployment](examples/kubernetes/)** - Cloud-native application

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/arbiter-framework/arbiter.git
cd arbiter

# Install dependencies
bun install

# Start the development server
bun run dev

# Build the CLI
bun run build:standalone

# Run tests
bun test
```

## License

This project is licensed under the [LicenseRef-SPL-1.0](LICENSE).

---

**Built with ❤️ for the future of AI-driven development**

*Arbiter is designed to work seamlessly with AI agents, automation workflows, and human developers alike. Experience the next generation of specification-driven development.*