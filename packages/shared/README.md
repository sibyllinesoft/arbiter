# @arbiter/shared

Shared types, schemas, and utilities for the Arbiter real-time collaborative CUE editor. This package provides common TypeScript types, Zod validation schemas, and protocol definitions used across both the API server and web frontend.

## Overview

This package ensures type safety and consistency across the entire Arbiter application by providing:

- **TypeScript Types** - Common interfaces and type definitions
- **Zod Schemas** - Runtime validation for API requests/responses and WebSocket messages  
- **Protocol Definitions** - WebSocket message types and communication protocols
- **Utility Functions** - Shared helper functions and constants

## Installation

This package is designed to be used within the Arbiter monorepo workspace:

```bash
# Install in workspace (from project root)
bun install

# Build shared package
bun run --cwd packages/shared build
```

## Usage

### In API Server

```typescript
import {
  createProjectSchema,
  analyzeRequestSchema,
  wsMessageSchema,
  type Project,
  type AnalysisResult
} from '@arbiter/shared';

// Validate incoming request
const validatedData = createProjectSchema.parse(requestBody);

// Use shared types
function createProject(data: CreateProject): Project {
  // Implementation
}
```

### In Web Frontend

```typescript
import {
  type Project,
  type WSMessage,
  type AnalysisResult,
  projectResponseSchema
} from '@arbiter/shared';

// Type-safe API responses
const projects: Project[] = await fetchProjects();

// Validate WebSocket messages
const message: WSMessage = wsMessageSchema.parse(rawMessage);
```

## API Reference

### Types

**Core Data Types:**
```typescript
interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface AnalysisResult {
  requestId: string;
  errors?: CUEError[];
  value?: any;
  graph?: GraphNode[];
}

interface CUEError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
}
```

**Request/Response Types:**
```typescript
interface CreateProject {
  name: string;
}

interface SaveRevision {
  text: string;
}

interface AnalyzeRequest {
  text: string;
  requestId: string;
}
```

**WebSocket Protocol Types:**
```typescript
interface HelloMessage {
  type: 'hello';
  version: string;
  clientId?: string;
}

interface JoinMessage {
  type: 'join';
  projectId: string;
  user: {
    id: string;
    name: string;
    color: string;
  };
}

interface CursorMessage {
  type: 'cursor';
  projectId: string;
  position: {
    line: number;
    column: number;
    selectionStart?: { line: number; column: number };
    selectionEnd?: { line: number; column: number };
  };
}

// Union type for all WebSocket messages
type WSMessage = HelloMessage | JoinMessage | CursorMessage | /* ... */;
```

### Schemas

**Validation Schemas (Zod):**
```typescript
// Project schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(255)
});

const projectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Analysis schemas
const analyzeRequestSchema = z.object({
  text: z.string().max(64 * 1024), // 64KB limit
  requestId: z.string()
});

const analysisResultSchema = z.object({
  requestId: z.string(),
  errors: z.array(cueErrorSchema).optional(),
  value: z.any().optional(),
  graph: z.array(graphNodeSchema).optional()
});

// WebSocket message schemas
const wsMessageSchema = z.discriminatedUnion('type', [
  helloMessageSchema,
  joinMessageSchema,
  cursorMessageSchema,
  syncMessageSchema,
  analyzeMessageSchema,
  leaveMessageSchema
]);
```

### Protocol Definitions

**WebSocket Message Types:**
```typescript
// Message type constants
export const WS_MESSAGE_TYPES = {
  HELLO: 'hello',
  JOIN: 'join', 
  LEAVE: 'leave',
  CURSOR: 'cursor',
  SYNC: 'sync',
  ANALYZE: 'analyze',
  ANALYSIS: 'analysis',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  ERROR: 'error'
} as const;

// Protocol version
export const PROTOCOL_VERSION = '1.0';

// Configuration constants
export const CONFIG = {
  MAX_TEXT_SIZE: 64 * 1024, // 64KB
  ANALYSIS_TIMEOUT: 750,    // 750ms
  RATE_LIMIT: 1,           // 1 request per second
  MAX_GRAPH_NODES: 200     // Graph complexity limit
} as const;
```

## Development

### Building

```bash
# Build TypeScript to JavaScript
bun run --cwd packages/shared build

# Watch mode for development
bun run --cwd packages/shared dev
```

### Testing

```bash
# Run tests
bun run --cwd packages/shared test

# Run tests in watch mode
bun test --watch

# Run with coverage
bun test --coverage
```

### Code Quality

```bash
# Type checking
bun run --cwd packages/shared typecheck

# Linting
bun run --cwd packages/shared lint
```

## Project Structure

```
packages/shared/
├── src/
│   ├── index.ts          # Main exports
│   ├── types.ts          # TypeScript type definitions
│   ├── schemas.ts        # Zod validation schemas
│   ├── protocols.ts      # WebSocket protocol definitions
│   └── index.test.ts     # Test suite
├── dist/                 # Compiled JavaScript output
│   ├── index.js         # Main entry point
│   ├── index.d.ts       # Type definitions
│   └── *.js             # Compiled modules
├── package.json         # Package configuration
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Architecture

### Design Principles

1. **Type Safety First** - All data structures have corresponding TypeScript types
2. **Runtime Validation** - Zod schemas validate data at runtime boundaries
3. **Single Source of Truth** - All shared types defined once, used everywhere
4. **Protocol Versioning** - WebSocket protocol includes version negotiation
5. **Performance Conscious** - Lightweight with minimal dependencies

### Schema Strategy

The package uses a layered validation approach:

1. **TypeScript Types** - Compile-time type checking
2. **Zod Schemas** - Runtime validation and parsing
3. **Protocol Definitions** - Structured message format validation

```typescript
// Example validation flow
const rawData = await request.json();           // unknown
const validated = createProjectSchema.parse(rawData); // CreateProject
const project: Project = await createProject(validated); // Project
```

### Error Handling

All schemas include proper error handling with descriptive messages:

```typescript
try {
  const message = wsMessageSchema.parse(rawData);
  // Handle valid message
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Invalid message format:', error.errors);
    // Send error response with specific field errors
  }
}
```

## Dependencies

### Production Dependencies

- **zod** ^3.23.8 - Runtime type validation and parsing

### Development Dependencies

- **typescript** ^5.6.3 - TypeScript compiler
- **bun** - Test runner and development tools

## Versioning

The package follows semantic versioning:

- **Major** - Breaking changes to types or schemas
- **Minor** - New types or schemas (backward compatible)
- **Patch** - Bug fixes and documentation updates

## Testing

The test suite covers:

### Schema Validation Tests
```typescript
describe('createProjectSchema', () => {
  it('validates correct project data', () => {
    const valid = { name: 'Test Project' };
    expect(createProjectSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid project data', () => {
    const invalid = { name: '' }; // Empty name
    expect(() => createProjectSchema.parse(invalid)).toThrow();
  });
});
```

### Type Compatibility Tests
```typescript
describe('type compatibility', () => {
  it('ensures AnalysisResult matches schema', () => {
    const result: AnalysisResult = {
      requestId: 'test-123',
      errors: [],
      value: { name: 'test' }
    };
    
    expect(analysisResultSchema.parse(result)).toEqual(result);
  });
});
```

### Protocol Message Tests
```typescript
describe('WebSocket protocol', () => {
  it('validates all message types', () => {
    const messages = [
      { type: 'hello', version: '1.0' },
      { type: 'join', projectId: '123', user: { id: '1', name: 'Test', color: '#ff0000' } },
      // ... other message types
    ];

    messages.forEach(msg => {
      expect(() => wsMessageSchema.parse(msg)).not.toThrow();
    });
  });
});
```

## Contributing

When adding new types or schemas:

1. **Add TypeScript types** in `types.ts`
2. **Create Zod schemas** in `schemas.ts`
3. **Update protocol definitions** in `protocols.ts` if needed
4. **Export from** `index.ts`
5. **Add comprehensive tests** in `index.test.ts`
6. **Update this README** with new API documentation

### Guidelines

- Use descriptive type names (`CreateProject` not `CreateReq`)
- Include JSDoc comments for complex types
- Validate all external boundaries with Zod
- Keep schemas strict but handle edge cases gracefully
- Maintain backward compatibility when possible

## License

MIT - See [LICENSE](../../LICENSE) file for details.