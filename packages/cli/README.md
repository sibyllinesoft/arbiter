# @sibyllinesoft/arbiter-cli

> CUE-based specification validation and management CLI with agent-first automation

[![npm version](https://badge.fury.io/js/%40sibyllinesoft%2Farbiter-cli.svg)](https://www.npmjs.com/package/@sibyllinesoft/arbiter-cli)
[![License](https://img.shields.io/badge/license-SPL--1.0-blue.svg)](LICENSE)

## Features

- 🎯 **Declarative Infrastructure** - Define complex systems in CUE and generate everything
- 🤖 **Agent-First Design** - CLI optimized for AI/automation consumption
- 📦 **Full-Stack Generation** - From database schemas to UI components to CI/CD pipelines
- ✅ **Validation-First** - Strong typing and validation throughout the development lifecycle
- 🚀 **Pre-built Presets** - Quick start with web-app, mobile-app, api-service, and microservice templates

## Installation

### Via npm

```bash
npm install -g @sibyllinesoft/arbiter-cli
```

### Via yarn

```bash
yarn global add @sibyllinesoft/arbiter-cli
```

### Via pnpm

```bash
pnpm add -g @sibyllinesoft/arbiter-cli
```

### Via bun

```bash
bun add -g @sibyllinesoft/arbiter-cli
```

## Quick Start

### 1. Initialize a New Project

**From a preset (recommended):**

```bash
# Create a full-stack web application
arbiter init my-app --preset web-app

# Create a mobile app
arbiter init my-mobile-app --preset mobile-app

# Create an API service
arbiter init my-api --preset api-service

# Create a microservice
arbiter init my-service --preset microservice
```

**From a template:**

```bash
# Create a basic CUE project
arbiter init my-project --template basic

# Create a Kubernetes configuration project
arbiter init k8s-config --template kubernetes

# Create an API schema project
arbiter init api-schema --template api
```

### 2. Add Components to Your Specification

```bash
# Add a service
arbiter add service api --language typescript --port 3000

# Add a database
arbiter add database postgres --engine postgresql

# Add an endpoint
arbiter add endpoint /users --method GET --service api

# Add a frontend route
arbiter add route /dashboard --component Dashboard
```

### 3. Generate Code from Specification

```bash
# Generate all artifacts
arbiter generate

# Validate your CUE files
arbiter check

# Watch for changes
arbiter watch
```

## Available Commands

### Project Management

- \`arbiter init [name]\` - Initialize a new project
- \`arbiter add <type> <name>\` - Add components to your specification
- \`arbiter list <type>\` - List components by type
- \`arbiter status\` - Show project status

### Development

- \`arbiter generate\` - Generate code from specifications
- \`arbiter check [patterns...]\` - Validate CUE files
- \`arbiter watch [path]\` - Watch files with live validation
- \`arbiter diff <old> <new>\` - Compare CUE schemas

### Integration

- \`arbiter integrate\` - Generate CI/CD workflows
- \`arbiter sync\` - Synchronize project manifests
- \`arbiter surface <language>\` - Extract API surface from code

### Utilities

- \`arbiter health\` - Check server health
- \`arbiter version\` - Show version information

## Entity Types

The CLI supports 26+ entity types:

**Services & Infrastructure:**
- \`service\` - Microservices
- \`client\` - Client applications
- \`database\` - Databases
- \`cache\` - Cache services
- \`load-balancer\` - Load balancers
- \`infrastructure\` - Infrastructure components

**API & Communication:**
- \`endpoint\` - API endpoints
- \`route\` - UI routes
- \`view\` - UI views
- \`contract\` - Workflow contracts
- \`schema\` - API schemas

**Business Logic:**
- \`flow\` - User flows
- \`module\` - Modules
- \`component\` - UI components
- \`package\` - Packages
- \`capability\` - Business capabilities

**Project Management:**
- \`epic\` - Project epics
- \`task\` - Tasks
- \`tool\` - Developer tools

And more...

## Configuration

Create an \`.arbiter/config.json\` in your project:

```json
{
  "apiUrl": "http://localhost:5050",
  "format": "table",
  "color": true,
  "timeout": 10000
}
```

## Examples

### List Available Presets

```bash
arbiter init --list-presets
```

Output:
```
Available presets (require API server):

web-app         Full-stack web application with React frontend and Node.js backend
mobile-app      Cross-platform mobile app with React Native
api-service     RESTful API service with database integration
microservice    Containerized microservice with monitoring
```

### List All Services in Project

```bash
arbiter list service
```

### Generate CI/CD Workflows

```bash
arbiter integrate
```

### Extract API Surface from TypeScript Code

```bash
arbiter surface typescript
```

## Requirements

- Node.js >= 18.0.0
- CUE (for local validation)
- Arbiter API server (for preset-based initialization and advanced features)

## Development

```bash
# Clone the repository
git clone https://github.com/sibyllinesoft/arbiter.git
cd arbiter/packages/cli

# Install dependencies
bun install

# Build the CLI
bun run build

# Run tests
bun test

# Run in development mode
bun run dev
```

## Documentation

For comprehensive documentation, visit [https://github.com/sibyllinesoft/arbiter](https://github.com/sibyllinesoft/arbiter)

## License

LicenseRef-SPL-1.0

## Author

Nathan Rice

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

- 🐛 [Report Issues](https://github.com/sibyllinesoft/arbiter/issues)
- 💬 [Discussions](https://github.com/sibyllinesoft/arbiter/discussions)
- 📖 [Documentation](https://github.com/sibyllinesoft/arbiter#readme)
