# Code Generation Best Practices Guide

This guide provides best practices, patterns, and troubleshooting advice for effective use of Arbiter's code generation system.

## Table of Contents

- [Development Workflow](#development-workflow)
- [Project Structure Guidelines](#project-structure-guidelines)
- [Template Design Patterns](#template-design-patterns)
- [Performance Optimization](#performance-optimization)
- [Testing Strategies](#testing-strategies)
- [Security Considerations](#security-considerations)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Common Anti-Patterns](#common-anti-patterns)

## Development Workflow

### Recommended Development Process

Follow this workflow for efficient code generation development:

#### 1. Specification-First Development

Start with comprehensive CUE specifications before any code generation:

```cue
// .arbiter/my-app/assembly.cue
package myapp

{
  product: {
    name: "My Application"
    goals: [
      "Provide fast, reliable user authentication",
      "Scale to handle 10k concurrent users",
      "Maintain 99.9% uptime"
    ]
  }
  
  // Define capabilities first
  capabilities: {
    "auth.users": {
      owner: "backend@company.com"
      description: "User authentication and management"
      kind: "service"
    }
    "ui.dashboard": {
      owner: "frontend@company.com" 
      description: "User dashboard interface"
      kind: "ui"
    }
  }
  
  // Then define implementation
  services: {
    auth: {
      language: "typescript"
      capabilities: ["auth.users"]
      // ... detailed configuration
    }
  }
}
```

#### 2. Iterative Generation and Testing

Use an iterative approach with frequent validation:

```bash
# 1. Validate specification
arbiter check .arbiter/my-app/assembly.cue

# 2. Generate with dry-run first
arbiter generate --dry-run --verbose

# 3. Generate to temporary directory
arbiter generate --output-dir /tmp/test-generation

# 4. Validate generated code
cd /tmp/test-generation
npm install && npm run test

# 5. Generate to target directory
arbiter generate --force
```

#### 3. Continuous Integration

Integrate generation into CI/CD pipeline:

```yaml
# .github/workflows/generate.yml
name: Code Generation

on: [push, pull_request]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install Arbiter CLI
        run: bun install -g @arbiter/cli
        
      - name: Validate specifications
        run: arbiter check
        
      - name: Test generation
        run: |
          arbiter generate --dry-run
          arbiter generate --output-dir ./test-output
          cd test-output && npm test
          
      - name: Check for generation drift
        run: |
          arbiter generate --output-dir ./current-gen
          diff -r ./current-gen ./src || {
            echo "Generated code differs from committed code"
            exit 1
          }
```

### Version Control Strategy

#### Generated Code Handling

**Option 1: Commit Generated Code (Recommended)**
```gitignore
# .gitignore
node_modules/
.env
.arbiter/cache/

# Keep generated code in version control
# This ensures reproducible builds and easy code review
```

**Option 2: Generate on Build**
```gitignore
# .gitignore
node_modules/
.env
src/          # Generated source directory
dist/
.arbiter/cache/
```

```json
// package.json
{
  "scripts": {
    "prebuild": "arbiter generate",
    "build": "tsc && bundler build",
    "dev": "arbiter generate && concurrently 'arbiter watch' 'nodemon'"
  }
}
```

## Project Structure Guidelines

### Monorepo Structure

Organize generated code in a clear hierarchy:

```
project-root/
├── .arbiter/              # Specifications
│   ├── app/
│   │   └── assembly.cue
│   └── shared/
│       └── types.cue
├── packages/              # Generated packages
│   ├── services/          # Backend services
│   │   ├── auth-service/
│   │   ├── user-service/
│   │   └── notification-service/
│   ├── clients/           # Frontend applications
│   │   ├── admin-dashboard/
│   │   ├── user-portal/
│   │   └── mobile-app/
│   ├── shared/            # Shared libraries
│   │   ├── types/
│   │   ├── utils/
│   │   └── ui-components/
│   └── infrastructure/    # Deployment configs
│       ├── docker/
│       ├── kubernetes/
│       └── terraform/
├── tools/                 # Development tools
│   ├── generators/        # Custom generators
│   └── scripts/           # Build scripts
└── docs/                  # Documentation
    ├── api/
    ├── architecture/
    └── runbooks/
```

### Service Organization

Structure generated services for maintainability:

```
packages/services/user-service/
├── src/
│   ├── main.ts           # Entry point
│   ├── routes/           # Route handlers
│   │   ├── users.ts
│   │   ├── auth.ts
│   │   └── index.ts
│   ├── models/           # Data models
│   │   ├── User.ts
│   │   └── Session.ts
│   ├── services/         # Business logic
│   │   ├── UserService.ts
│   │   └── AuthService.ts
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   └── errorHandler.ts
│   └── utils/            # Utilities
│       ├── logger.ts
│       └── database.ts
├── tests/                # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/                 # Service documentation
│   ├── API.md
│   └── README.md
├── docker/               # Docker configuration
│   ├── Dockerfile
│   └── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

### Configuration Management

Separate configuration by environment:

```
packages/services/user-service/
├── config/
│   ├── base.ts           # Base configuration
│   ├── development.ts    # Development overrides
│   ├── staging.ts        # Staging configuration
│   ├── production.ts     # Production configuration
│   └── test.ts          # Test configuration
└── src/
    └── config.ts        # Configuration loader
```

```typescript
// src/config.ts
import { Config } from './types';
import baseConfig from '../config/base';
import devConfig from '../config/development';
import prodConfig from '../config/production';

const configs: Record<string, Partial<Config>> = {
  development: devConfig,
  staging: {},  
  production: prodConfig,
  test: {}
};

export const config: Config = {
  ...baseConfig,
  ...configs[process.env.NODE_ENV || 'development']
};
```

## Template Design Patterns

### Component Composition Pattern

Design templates for composability:

```handlebars
{{!-- Base service template --}}
{{>header}}

{{>imports}}

{{>configuration}}

{{#each features}}
  {{>feature this}}
{{/each}}

{{>middleware-setup}}

{{>routes}}

{{>startup}}

{{>exports}}
```

### Conditional Feature Pattern

Use feature flags for optional functionality:

```handlebars
{{!-- Feature-based generation --}}
{{#if features.authentication}}
  {{>authentication-setup}}
{{/if}}

{{#if features.database}}
  {{>database-setup}}
{{/if}}

{{#if features.logging}}
  {{>logging-setup}}
{{/if}}

{{#if features.metrics}}
  {{>metrics-setup}}
{{/if}}
```

### Data Transformation Pattern

Prepare data in context rather than templates:

```typescript
// Context preparation (Good)
function prepareServiceContext(spec: ServiceSpec): ServiceContext {
  return {
    ...spec,
    // Pre-compute complex values
    formattedEndpoints: spec.endpoints.map(formatEndpoint),
    groupedMiddleware: groupBy(spec.middleware, 'type'),
    sortedDependencies: spec.dependencies.sort(),
    
    // Boolean flags for template logic
    hasAuth: spec.features?.includes('auth'),
    hasDatabase: spec.database !== undefined,
    isProduction: spec.environment === 'production'
  };
}
```

```handlebars
{{!-- Template usage (Good) --}}
{{#if hasAuth}}
  {{>authentication-middleware}}
{{/if}}

{{#each formattedEndpoints}}
  {{>endpoint-handler this}}
{{/each}}
```

### Layered Template Pattern

Build templates in layers for maintainability:

```handlebars
{{!-- Layer 1: Base structure --}}
{{!-- templates/base/service.hbs --}}
{{>file-header}}
{{>imports}}
{{>app-setup}}
{{{content}}}
{{>app-startup}}

{{!-- Layer 2: Feature layer --}}
{{!-- templates/features/rest-api.hbs --}}
{{#extend "base/service"}}
{{#content}}
{{#each endpoints}}
{{>rest-endpoint this}}
{{/each}}
{{/content}}
{{/extend}}

{{!-- Layer 3: Specific implementation --}}
{{!-- templates/typescript/express-service.hbs --}}
{{#extend "features/rest-api"}}
{{#block "imports"}}
import express from 'express';
{{/block}}
{{#block "app-setup"}}
const app = express();
{{/block}}
{{/extend}}
```

## Performance Optimization

### Generation Performance

#### Parallel Generation

Configure parallel generation for large projects:

```json
{
  "generator": {
    "performance": {
      "parallel": true,
      "maxConcurrency": 4,
      "batchSize": 10
    }
  }
}
```

#### Template Caching

Implement template caching for repeated builds:

```typescript
// Custom template cache
class TemplateCache {
  private cache = new Map<string, CompiledTemplate>();
  
  async getTemplate(path: string): Promise<CompiledTemplate> {
    if (!this.cache.has(path)) {
      const template = await this.compileTemplate(path);
      this.cache.set(path, template);
    }
    return this.cache.get(path)!;
  }
}
```

#### Incremental Generation

Only regenerate changed files:

```typescript
// Implement file fingerprinting
class IncrementalGenerator {
  private fingerprints = new Map<string, string>();
  
  async shouldRegenerate(templatePath: string, context: any): Promise<boolean> {
    const currentFingerprint = this.computeFingerprint(templatePath, context);
    const previousFingerprint = this.fingerprints.get(templatePath);
    
    if (currentFingerprint !== previousFingerprint) {
      this.fingerprints.set(templatePath, currentFingerprint);
      return true;
    }
    
    return false;
  }
}
```

### Runtime Performance

#### Optimize Generated Code

Configure generation for performance:

```json
{
  "generator": {
    "plugins": {
      "typescript": {
        "optimization": {
          "treeShaking": true,
          "deadCodeElimination": true,
          "bundling": "esbuild"
        }
      }
    }
  }
}
```

#### Minimize Bundle Size

Generate efficient imports:

```handlebars
{{!-- Generate specific imports instead of wildcard --}}
{{#each usedFunctions}}
import { {{ this }} } from '{{ @root.packageName }}';
{{/each}}

{{!-- Instead of --}}
import * as utils from 'utils';
```

## Testing Strategies

### Generation Testing

#### Template Unit Testing

Test templates in isolation:

```typescript
// template.spec.ts
describe('Service Template', () => {
  test('generates valid TypeScript service', async () => {
    const context = createMockContext({
      serviceName: 'userService',
      endpoints: [mockEndpoint]
    });
    
    const result = await renderTemplate('service/main.ts.hbs', context);
    
    // Validate TypeScript syntax
    expect(() => ts.createSourceFile('test.ts', result, ts.ScriptTarget.Latest))
      .not.toThrow();
    
    // Validate content
    expect(result).toContain('userService');
    expect(result).toMatchSnapshot();
  });
});
```

#### Integration Testing

Test complete generation workflows:

```typescript
// integration.spec.ts
describe('Complete Generation', () => {
  test('generates working application', async () => {
    const tempDir = await fs.mkdtemp('/tmp/arbiter-test');
    
    try {
      // Generate project
      await generateCommand({
        outputDir: tempDir,
        spec: 'test-spec'
      }, defaultConfig);
      
      // Build generated project
      const buildResult = await exec('npm run build', { cwd: tempDir });
      expect(buildResult.code).toBe(0);
      
      // Run tests
      const testResult = await exec('npm test', { cwd: tempDir });
      expect(testResult.code).toBe(0);
      
    } finally {
      await fs.remove(tempDir);
    }
  });
});
```

### Generated Code Testing

#### Test Generation

Generate comprehensive tests:

```handlebars
{{!-- Generate unit tests --}}
{{#each services}}
describe('{{ this.name }}', () => {
  {{#each this.endpoints}}
  test('{{ this.method }} {{ this.path }}', async () => {
    {{#if this.auth}}
    const authToken = await getTestToken();
    {{/if}}
    
    const response = await request(app)
      .{{ this.method | lowercase }}('{{ this.path }}')
      {{#if this.auth}}
      .set('Authorization', `Bearer ${authToken}`)
      {{/if}}
      {{#if this.requestBody}}
      .send({{ this.requestBody | json }})
      {{/if}}
      .expect({{ this.successStatus }});
      
    {{#each this.assertions}}
    expect(response.body).{{ this }};
    {{/each}}
  });
  {{/each}}
});
{{/each}}
```

#### Load Testing

Generate load test configurations:

```handlebars
{{!-- K6 load test configuration --}}
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: {{ loadTest.rampUpUsers }} },
    { duration: '1m', target: {{ loadTest.sustainedUsers }} },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<{{ loadTest.p95Threshold }}'],
    http_req_failed: ['rate<0.1']
  }
};

export default function() {
  {{#each endpoints}}
  {{#if this.loadTest}}
  let response = http.{{ this.method | lowercase }}('{{ baseUrl }}{{ this.path }}', {
    {{#if this.requestBody}}
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({{ this.loadTest.payload | json }})
    {{/if}}
  });
  
  check(response, {
    '{{ this.path }} status is {{ this.successStatus }}': (r) => r.status === {{ this.successStatus }},
    '{{ this.path }} response time < {{ this.loadTest.threshold }}ms': (r) => r.timings.duration < {{ this.loadTest.threshold }}
  });
  {{/if}}
  {{/each}}
}
```

## Security Considerations

### Input Validation

Generate comprehensive input validation:

```handlebars
{{#each endpoints}}
{{#if this.parameters}}
// Validate {{ this.method }} {{ this.path }} parameters
const {{ this.name }}Schema = z.object({
  {{#each this.parameters}}
  {{ this.name }}: z.{{ this.type }}(){{#if this.required}}.required(){{/if}}{{#if this.validation}}.{{ this.validation }}(){{/if}},
  {{/each}}
});

app.{{ this.method }}('{{ this.path }}', 
  validate({{ this.name }}Schema),
  async (req, res) => {
    // Handler implementation
  }
);
{{/if}}
{{/each}}
```

### Authentication & Authorization

Generate secure auth patterns:

```handlebars
{{#if auth}}
// Authentication middleware
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await {{ auth.provider }}.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

{{#if auth.roles}}
// Role-based authorization
const authorize = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const userRoles = req.user?.roles || [];
  const hasRole = roles.some(role => userRoles.includes(role));
  
  if (!hasRole) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  next();
};
{{/if}}
{{/if}}
```

### Secure Defaults

Configure secure defaults in templates:

```handlebars
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: [{{ allowedOrigins | json }}],
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: {{ rateLimit | default 100 }} // limit each IP
}));
```

## Troubleshooting Guide

### Common Issues

#### Template Compilation Errors

**Problem**: Template fails to compile
```
Error: Parse error on line 15:
...{{#each endpoints}}{{#if
```

**Solution**: Check template syntax
```bash
# Validate template syntax
arbiter template validate templates/service/main.ts.hbs

# Debug with verbose output
arbiter generate --dry-run --verbose
```

#### Context Data Missing

**Problem**: Variables are undefined in templates
```
TypeError: Cannot read property 'name' of undefined
```

**Solution**: Validate context data structure
```typescript
// Add context validation
function validateContext(context: any): void {
  const required = ['serviceName', 'endpoints'];
  for (const field of required) {
    if (!context[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}
```

#### Generated Code Compilation Errors

**Problem**: Generated TypeScript doesn't compile
```
error TS2304: Cannot find name 'UserService'
```

**Solution**: Check import generation
```handlebars
{{!-- Ensure proper imports --}}
{{#each dependencies}}
import { {{ this.exports }} } from '{{ this.package }}';
{{/each}}

{{#each models}}
import type { {{ this.name }} } from './models/{{ this.name }}';
{{/each}}
```

### Debugging Techniques

#### Template Debugging

Add debug output to templates:

```handlebars
{{!-- Debug context data --}}
{{#if debug}}
<!-- Context Debug:
{{{json this}}}
-->
{{/if}}

{{!-- Conditional debugging --}}
{{#if (eq environment "development")}}
console.log('Debug: {{ serviceName }} context:', {{{json this}}});
{{/if}}
```

#### Generation Debugging

Enable verbose logging:

```bash
# Maximum verbosity
DEBUG=arbiter:* arbiter generate --verbose

# Specific component debugging
DEBUG=arbiter:template-resolver arbiter generate

# Save generation log
arbiter generate --verbose > generation.log 2>&1
```

### Performance Troubleshooting

#### Slow Generation

Profile generation performance:

```typescript
// Add timing to generation steps
console.time('Template Resolution');
const template = await resolver.getTemplate(templatePath);
console.timeEnd('Template Resolution');

console.time('Context Preparation');
const context = await prepareContext(spec);
console.timeEnd('Context Preparation');

console.time('Template Rendering');
const result = await template.render(context);
console.timeEnd('Template Rendering');
```

#### Memory Issues

Monitor memory usage:

```bash
# Run with memory profiling
node --max-old-space-size=4096 --inspect arbiter generate

# Monitor memory usage
watch -n 1 'ps aux | grep arbiter'
```

## Common Anti-Patterns

### Avoid These Patterns

#### 1. Complex Logic in Templates

**Bad**:
```handlebars
{{#each endpoints}}
{{#if (and (eq this.method "GET") (gt this.parameters.length 0) (not this.auth))}}
<!-- Complex conditional logic in template -->
{{/if}}
{{/each}}
```

**Good**:
```typescript
// Prepare in context
const publicGetEndpoints = endpoints.filter(e => 
  e.method === 'GET' && 
  e.parameters?.length > 0 && 
  !e.auth
);
```

```handlebars
{{#each publicGetEndpoints}}
<!-- Simple template logic -->
{{/each}}
```

#### 2. Hardcoded Values

**Bad**:
```handlebars
const PORT = 3000;
const DB_HOST = 'localhost';
```

**Good**:
```handlebars
const PORT = process.env.PORT || {{ defaultPort }};
const DB_HOST = process.env.DB_HOST || '{{ database.host }}';
```

#### 3. Monolithic Templates

**Bad**:
```handlebars
{{!-- 500 line template with everything --}}
```

**Good**:
```handlebars
{{>header}}
{{>imports}}
{{>configuration}}
{{#each features}}
{{>feature-{{this}} }}
{{/each}}
{{>exports}}
```

#### 4. Context Pollution

**Bad**:
```typescript
// Adding too much data to context
const context = {
  ...everythingFromSpec,
  ...allConfiguration,
  ...allHelperFunctions,
  // Templates become unclear about available data
};
```

**Good**:
```typescript
// Focused context per template
const serviceContext = {
  serviceName: spec.name,
  endpoints: spec.endpoints,
  auth: spec.auth,
  // Only what this template needs
};
```

#### 5. No Error Handling

**Bad**:
```typescript
// Generation without error handling
await generateService(spec);
await generateClient(spec);
await generateDocs(spec);
```

**Good**:
```typescript
// Proper error handling
try {
  await generateService(spec);
} catch (error) {
  console.error(`Service generation failed: ${error.message}`);
  throw new GenerationError('Service generation failed', { spec, error });
}
```

This comprehensive guide provides the foundation for successful code generation with Arbiter, covering all aspects from development workflow to production deployment.
