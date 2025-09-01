# API Documentation

This document provides comprehensive documentation for the Arbiter API, including REST endpoints and WebSocket protocol.

## Base URL

- **Development**: `http://localhost:3001`
- **WebSocket**: `ws://localhost:3001`

## Authentication

The current version (v0) does not require authentication. Future versions will include user authentication and project-level permissions.

## Rate Limiting

- **Analysis requests**: 1 request per second per client
- **WebSocket messages**: No explicit limit, but internal queuing applies
- **HTTP requests**: No explicit limit for CRUD operations

Rate limits are enforced per client using the `x-client-id` header or 'anonymous' if not provided.

## Error Handling

All API responses follow consistent error formats:

### HTTP Error Response

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created successfully  
- `400 Bad Request` - Invalid request body or parameters
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server processing error

## REST API Endpoints

### Projects

#### List All Projects

Get a list of all projects, ordered by most recently updated.

```http
GET /projects
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Configuration",
    "created_at": "2024-01-01T10:00:00.000Z",
    "updated_at": "2024-01-01T10:30:00.000Z"
  }
]
```

**Response Schema:**
- `id` (string): UUID of the project
- `name` (string): Display name of the project
- `created_at` (string): ISO 8601 timestamp when project was created
- `updated_at` (string): ISO 8601 timestamp when project was last modified

#### Create New Project

Create a new project with the specified name.

```http
POST /projects
Content-Type: application/json

{
  "name": "My New Configuration"
}
```

**Request Body:**
- `name` (string, required): Display name for the project (1-255 characters)

**Response (201 Created):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My New Configuration",
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-01T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or missing name

#### Get Project Details

Retrieve details for a specific project.

```http
GET /projects/{projectId}
```

**Path Parameters:**
- `projectId` (string, required): UUID of the project

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My Configuration",
  "created_at": "2024-01-01T10:00:00.000Z",
  "updated_at": "2024-01-01T10:30:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Project with specified ID does not exist

#### Save Project Revision

Save a new revision of the project's CUE content. Revisions are append-only and automatically versioned.

```http
POST /projects/{projectId}/revisions
Content-Type: application/json

{
  "text": "package config\n\nname: \"my-app\"\nversion: \"1.0.0\""
}
```

**Path Parameters:**
- `projectId` (string, required): UUID of the project

**Request Body:**
- `text` (string, required): CUE configuration text to save

**Response:**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request`: Invalid or missing text content
- `404 Not Found`: Project with specified ID does not exist

### CUE Analysis

#### Analyze CUE Configuration

Perform real-time analysis of CUE configuration text, including validation, parsing, and graph generation.

```http
POST /analyze
Content-Type: application/json
x-client-id: your-client-id

{
  "text": "package config\n\nname: \"my-app\"\nversion: \"1.0.0\"",
  "requestId": "analysis-123456789"
}
```

**Headers:**
- `x-client-id` (string, optional): Client identifier for rate limiting

**Request Body:**
- `text` (string, required): CUE configuration to analyze (max 64KB)
- `requestId` (string, required): Unique identifier for tracking this analysis request

**Response (Success):**
```json
{
  "requestId": "analysis-123456789",
  "errors": [],
  "value": {
    "name": "my-app",
    "version": "1.0.0"
  },
  "graph": [
    {
      "id": "name",
      "label": "name",
      "type": "value"
    },
    {
      "id": "version", 
      "label": "version",
      "type": "value"
    }
  ]
}
```

**Response (Validation Errors):**
```json
{
  "requestId": "analysis-123456789",
  "errors": [
    {
      "message": "field not allowed",
      "line": 5,
      "column": 10,
      "filename": "doc.cue"
    }
  ]
}
```

**Response Schema:**
- `requestId` (string): Echo of the request ID for tracking
- `errors` (array): List of CUE validation errors
  - `message` (string): Human-readable error description
  - `line` (number, optional): Line number where error occurred (1-based)
  - `column` (number, optional): Column number where error occurred (1-based) 
  - `filename` (string, optional): File name where error occurred
- `value` (any, optional): Parsed CUE value if analysis succeeded
- `graph` (array, optional): Simplified graph representation of configuration structure
  - `id` (string): Unique identifier for the node
  - `label` (string): Display label for the node
  - `type` (string): Node type - "object", "array", or "value"
  - `children` (array, optional): Array of child node IDs for objects

**Error Responses:**
- `400 Bad Request`: Invalid request body or text too large
- `429 Too Many Requests`: Rate limit exceeded (1 request per second)

**Analysis Limits:**
- Maximum text size: 64KB
- Analysis timeout: 750ms
- Maximum concurrency: 4 simultaneous analyses
- Import statements are not allowed for security

**Graph Generation Rules:**
- Only top-level keys are included as nodes
- Large objects (>200 keys) are summarized as a single node
- Object children are limited to first 10 keys
- Graph optimizes for visualization performance

### Health Check

#### Server Status

Check if the server is running and responsive.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

*Note: This endpoint is not currently implemented in the server but recommended for production deployments.*

## WebSocket Protocol

The WebSocket connection enables real-time collaboration features including document synchronization, cursor tracking, and live analysis broadcasting.

### Connection

Connect to the WebSocket endpoint:
```javascript
const ws = new WebSocket('ws://localhost:3001');
```

The server automatically sends a hello message upon connection with a unique client ID.

### Message Format

All messages are JSON objects with a `type` field, except for Y.js binary updates which are handled separately.

### Connection Lifecycle

1. **Connect** - Client establishes WebSocket connection
2. **Hello** - Server sends welcome message with client ID  
3. **Join** - Client joins a specific project session
4. **Collaborate** - Real-time editing, cursor tracking, analysis
5. **Leave** - Client leaves project (optional)
6. **Disconnect** - Connection cleanup

### Message Types

#### Hello Messages

**Server → Client: Welcome**
```json
{
  "type": "hello",
  "clientId": "client-abc123", 
  "version": "1.0"
}
```

Sent automatically when a client connects. Provides a unique client ID for session tracking.

#### Session Management

**Client → Server: Join Project**
```json
{
  "type": "join",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "user": {
    "id": "user-123",
    "name": "Alice",
    "color": "#ff0000"
  }
}
```

Join a collaborative editing session for a specific project.

**Fields:**
- `projectId` (string): UUID of the project to join
- `user.id` (string): Unique identifier for the user
- `user.name` (string): Display name for the user (shown to other collaborators)
- `user.color` (string): Hex color for cursor/selection display (format: #RRGGBB)

**Server → Client: Join Confirmation**
```json
{
  "type": "joined",
  "projectId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Server → Client: User Joined Notification**
```json
{
  "type": "user-joined", 
  "user": {
    "id": "user-123",
    "name": "Alice",
    "color": "#ff0000"
  }
}
```

Broadcast to existing collaborators when a new user joins the project.

**Client → Server: Leave Project**
```json
{
  "type": "leave",
  "projectId": "550e8400-e29b-41d4-a716-446655440000"  
}
```

**Server → Client: User Left Notification**
```json
{
  "type": "user-left",
  "user": {
    "id": "user-123", 
    "name": "Alice",
    "color": "#ff0000"
  }
}
```

#### Presence (Cursor Tracking)

**Client → Server: Cursor Position**
```json
{
  "type": "cursor",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "position": {
    "line": 5,
    "column": 10,
    "selectionStart": {
      "line": 5,
      "column": 10  
    },
    "selectionEnd": {
      "line": 5,
      "column": 20
    }
  }
}
```

Share cursor position and text selection with other collaborators.

**Fields:**
- `position.line` (number): Line number (1-based)
- `position.column` (number): Column number (1-based) 
- `position.selectionStart` (object, optional): Start of text selection
- `position.selectionEnd` (object, optional): End of text selection

**Server → Client: Cursor Update**
```json
{
  "type": "cursor",
  "user": {
    "id": "user-123",
    "name": "Alice", 
    "color": "#ff0000"
  },
  "position": {
    "line": 5,
    "column": 10,
    "selectionStart": {
      "line": 5,
      "column": 10
    },
    "selectionEnd": {
      "line": 5,
      "column": 20
    }
  }
}
```

Broadcast cursor positions to other collaborators in the project.

#### Document Synchronization

**Client ↔ Server: Y.js Updates**
```json
{
  "type": "sync",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "update": "base64-encoded-yjs-update-data"
}
```

Synchronize document changes using Y.js CRDT format. Ensures conflict-free collaborative editing.

**Fields:**
- `update` (string): Base64-encoded Y.js update containing document changes

**Binary Y.js Updates:**
Y.js updates are also transmitted as binary WebSocket messages for efficiency. The server relays these binary messages to all connected clients in the same project.

#### Live Analysis

**Client → Server: Request Analysis**
```json
{
  "type": "analyze", 
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "analysis-123456789"
}
```

Request CUE analysis of the current document state. Analysis is performed on the server-side Y.js document.

**Server → Client: Analysis Results**
```json
{
  "type": "analysis",
  "requestId": "analysis-123456789", 
  "errors": [
    {
      "message": "field not allowed",
      "line": 5,
      "column": 10,
      "filename": "doc.cue"
    }
  ],
  "value": {
    "name": "example",
    "version": "1.0.0"
  },
  "graph": [
    {
      "id": "name",
      "label": "name", 
      "type": "value"
    }
  ]
}
```

Analysis results are broadcast to all collaborators in the project.

#### Error Handling

**Server → Client: Error**
```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

## Client SDKs and Examples

### JavaScript/TypeScript Example

```typescript
import { WebSocket } from 'ws';

class ArbiterClient {
  private ws: WebSocket;
  private clientId?: string;
  
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'hello':
          this.clientId = message.clientId;
          console.log(`Connected with ID: ${this.clientId}`);
          break;
          
        case 'analysis':
          console.log('Analysis result:', message);
          break;
          
        case 'cursor':
          console.log(`User ${message.user.name} cursor:`, message.position);
          break;
      }
    });
  }
  
  joinProject(projectId: string, user: { id: string, name: string, color: string }) {
    this.ws.send(JSON.stringify({
      type: 'join',
      projectId,
      user
    }));
  }
  
  updateCursor(projectId: string, position: { line: number, column: number }) {
    this.ws.send(JSON.stringify({
      type: 'cursor', 
      projectId,
      position
    }));
  }
  
  requestAnalysis(projectId: string) {
    const requestId = `analysis-${Date.now()}`;
    this.ws.send(JSON.stringify({
      type: 'analyze',
      projectId, 
      requestId
    }));
  }
}

// Usage
const client = new ArbiterClient('ws://localhost:3001');

// Wait for connection, then join project
setTimeout(() => {
  client.joinProject('my-project-id', {
    id: 'user-1',
    name: 'Developer',
    color: '#0066cc'
  });
}, 100);
```

### REST API Example

```typescript
class ArbiterAPI {
  private baseUrl: string;
  private clientId: string;
  
  constructor(baseUrl: string, clientId?: string) {
    this.baseUrl = baseUrl;
    this.clientId = clientId || `client-${Date.now()}`;
  }
  
  async createProject(name: string) {
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  }
  
  async analyzeConfiguration(text: string) {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.clientId
      },
      body: JSON.stringify({ 
        text,
        requestId: `analysis-${Date.now()}`
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  }
  
  async getProjects() {
    const response = await fetch(`${this.baseUrl}/projects`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  }
  
  async saveRevision(projectId: string, text: string) {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/revisions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.json();
  }
}

// Usage
const api = new ArbiterAPI('http://localhost:3001');

async function example() {
  // Create a new project
  const project = await api.createProject('My Configuration');
  console.log('Created project:', project);
  
  // Analyze some CUE code
  const analysis = await api.analyzeConfiguration(`
    package config
    
    name: "my-app"
    version: "1.0.0"
    
    server: {
      port: 8080
      host: "localhost"
    }
  `);
  console.log('Analysis result:', analysis);
  
  // Save the configuration
  await api.saveRevision(project.id, analysis.text);
}
```

## Development and Testing

### Running the API Server

```bash
# Install dependencies
bun install

# Start development server
bun run --cwd apps/api dev

# Server will be available at http://localhost:3001
```

### Testing with curl

```bash
# Create a project
curl -X POST http://localhost:3001/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}'

# Analyze CUE configuration
curl -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -H "x-client-id: test-client" \
  -d '{
    "text": "package config\n\nname: \"test\"\nversion: \"1.0.0\"",
    "requestId": "test-analysis"
  }'

# List projects
curl http://localhost:3001/projects
```

### WebSocket Testing

```bash
# Using websocat (https://github.com/vi/websocat)
websocat ws://localhost:3001

# Send hello message
{"type": "hello", "version": "1.0"}

# Join a project
{"type": "join", "projectId": "test-project", "user": {"id": "test-user", "name": "Tester", "color": "#ff0000"}}

# Request analysis
{"type": "analyze", "projectId": "test-project", "requestId": "test-123"}
```

## Security Considerations

- **Input Validation**: All requests validated using Zod schemas
- **Rate Limiting**: Prevents abuse with per-client analysis limits  
- **Sandboxed Execution**: CUE CLI runs in isolated temporary directories
- **No Imports**: Import statements blocked for security in v0
- **Resource Limits**: 64KB text limit, 750ms timeout, bounded concurrency
- **CORS**: Configured for development, customize for production

## Performance Notes

- **Analysis Timeout**: 750ms maximum per analysis request
- **Concurrency**: Maximum 4 simultaneous CUE analyses  
- **Large Configurations**: >200 nodes are summarized in graph output
- **WebSocket Efficiency**: Binary Y.js updates for minimal bandwidth
- **Connection Cleanup**: Automatic cleanup on disconnect

## CLI Commands API (Phase 5: Documentation & Polish)

The Arbiter CLI provides additional commands for documentation generation, example projects, and configuration analysis.

### Documentation Generation

#### Generate Schema Documentation

Generate comprehensive documentation from CUE schemas:

```bash
# Generate Markdown documentation
arbiter docs schema

# Generate HTML documentation  
arbiter docs schema --format html

# Generate JSON schema + examples
arbiter docs schema --format json --examples

# Custom output location
arbiter docs schema --format html --output ./docs/schema.html
```

**Options:**
- `--format` (`markdown` | `html` | `json`): Output format (default: `markdown`)
- `--output` (string): Custom output file path
- `--examples` (boolean): Include working code examples

**Generated Files:**
- **Markdown**: `schema-docs.md` - Professional documentation with table of contents
- **HTML**: `schema-docs.html` - Styled responsive documentation with syntax highlighting
- **JSON**: `schema-docs.json` - Structured data for tooling integration

#### Generate API Documentation

Generate API documentation from surface.json files:

```bash
# Generate API docs from surface.json
arbiter docs api --format markdown

# HTML format with examples
arbiter docs api --format html --examples
```

### Example Project Generation

#### Generate Profile Examples

Create complete working example projects:

```bash
# Generate all profile examples
arbiter examples profile

# Generate specific profile
arbiter examples profile --profile library
arbiter examples profile --profile cli

# Custom output directory
arbiter examples profile --output ./my-examples
```

**Available Profiles:**
- **typescript-library**: TypeScript library with Vitest, ESLint, publishing setup
- **typescript-cli**: CLI tool with Commander.js, argument parsing, testing
- **python-service**: FastAPI service with async patterns, type hints
- **rust-library**: Zero-cost abstractions with memory safety guarantees
- **go-microservice**: Concurrent microservice with standard patterns

#### Generate Language Examples

Generate language-specific examples:

```bash
# TypeScript examples
arbiter examples language --language typescript

# Python examples  
arbiter examples language --language python

# All supported languages
arbiter examples language
```

**Generated Structure:**
Each example includes:
- Complete project structure with source code
- Build tool configuration (package.json, Cargo.toml, etc.)
- Comprehensive test setup
- Production-ready arbiter.assembly.cue
- Documentation and README files
- CI/CD workflow examples

### Configuration Analysis

#### Plain-English Explanation

Transform technical configurations into understandable explanations:

```bash
# Basic explanation
arbiter explain

# Detailed analysis
arbiter explain --verbose  

# JSON export for tooling
arbiter explain --format json --output config-analysis.json

# Skip helpful hints
arbiter explain --no-hints
```

**Analysis Features:**
- **Project Detection**: Automatically identifies project type and patterns
- **Configuration Summary**: Plain-English description of all settings
- **Recommendations**: Context-aware suggestions for improvement
- **Issue Detection**: Identifies potential problems and solutions
- **Next Steps**: Actionable guidance for development workflow

**Example Output:**
```
🏗️  Project Configuration Summary
──────────────────────────────────────────────────

This project is configured as a library written in typescript 
called "@demo/awesome-library", using the library profile, 
built with bun, targeting ./src, ./lib.

📦 Artifact Details:
  Type: library
  Language: typescript
  Name: @demo/awesome-library
  Version: 1.2.3

🔨 Build Configuration:
  Build Tool: bun
  Targets: ./src, ./lib
  Build Matrix: Configured

🧪 Test Configuration:
  Test Types: contracts, property, golden
  Coverage: 95% threshold

🎯 Recommended Next Steps:
   1. Run "arbiter check" to validate your configuration
   2. Generate API surface with "arbiter surface typescript"
   3. Set up continuous validation with "arbiter watch"
```

### UX Polish Features

#### Enhanced Error Messages

All CLI commands include beautiful error messages with contextual help:

```bash
❌ Error
   arbiter.assembly.cue not found
   Context: Looking for project configuration

💡 Assembly configuration help:
   • Create assembly: arbiter init --template <type>
   • Understand config: arbiter explain
   • See examples: arbiter examples profile
   • Generate docs: arbiter docs schema
```

#### Progress Indicators

Long operations show animated progress indicators:

```bash
⠋ Generating comprehensive documentation...
⠙ Parsing CUE schemas and extracting structure...
⠹ Creating HTML documentation with styling...
✅ Generated documentation: schema-docs.html
```

#### Next-Step Guidance

Commands provide contextual next steps after completion:

```bash
🎯 Next steps:
   1. Edit arbiter.assembly.cue to customize your project
   2. Run "arbiter check" to validate configuration
   3. Use "arbiter explain" to understand your setup
   4. Generate examples with "arbiter examples profile"
```

### CLI Integration Examples

#### TypeScript/Node.js Integration

```typescript
import { execSync } from 'child_process';

// Generate documentation programmatically
const docResult = execSync('arbiter docs schema --format json', { encoding: 'utf8' });
const schema = JSON.parse(docResult);

// Analyze configuration
const explainResult = execSync('arbiter explain --format json', { encoding: 'utf8' });
const analysis = JSON.parse(explainResult);

console.log('Project type:', analysis.artifact.type);
console.log('Recommendations:', analysis.recommendations);
```

#### Shell Scripting Integration

```bash
#!/bin/bash

# Development workflow automation
echo "🚀 Setting up development environment..."

# Generate examples for reference
arbiter examples profile --profile library --output ./examples

# Validate current configuration
if arbiter check; then
    echo "✅ Configuration valid"
    
    # Generate documentation
    arbiter docs schema --format html
    
    # Get plain-English summary
    arbiter explain --verbose
else
    echo "❌ Configuration issues found"
    echo "💡 Try: arbiter explain for guidance"
fi
```

#### CI/CD Pipeline Integration

```yaml
# GitHub Actions workflow
- name: Generate Documentation
  run: |
    arbiter docs schema --format html --output ./docs/
    arbiter examples profile --output ./examples/
    
- name: Validate Configuration
  run: |
    arbiter check
    arbiter explain --format json > config-analysis.json
    
- name: Deploy Documentation
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./docs
```

## Future API Enhancements

- **Authentication**: JWT-based user authentication
- **Project Permissions**: Role-based access control (RBAC)
- **Revision History**: Detailed revision browsing and diff APIs
- **Webhooks**: Event notifications for external integrations
- **Batch Operations**: Bulk project and revision operations
- **Search**: Full-text search across projects and revisions
- **Import/Export**: Project backup and restore functionality
- **Custom Validators**: User-defined CUE validation rules
- **CLI Server Integration**: Direct integration between CLI commands and API server
- **Template Marketplace**: Community-driven example templates and profiles