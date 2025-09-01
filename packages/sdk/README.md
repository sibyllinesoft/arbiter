# @arbiter/sdk

[![npm version](https://badge.fury.io/js/@arbiter%2Fsdk.svg)](https://badge.fury.io/js/@arbiter%2Fsdk)

TypeScript SDK for [Arbiter](https://github.com/nathanrice/arbiter) - the "GitHub for Architecture" platform that provides real-time architecture validation, violation-aware diagrams, and multi-format exports.

## Installation

```bash
npm install @arbiter/sdk
# or
yarn add @arbiter/sdk
# or
pnpm add @arbiter/sdk
```

## Quick Start

```typescript
import { ArbiterClient } from '@arbiter/sdk';

// Create client
const client = new ArbiterClient({
  baseUrl: 'http://localhost:3000', // Your Arbiter server
  timeout: 30000,
  debug: true, // Enable debug logging
});

// Validate architecture
const result = await client.validateArchitecture({
  schema: `
    #APISpec: {
      version: string
      endpoints: [string]: {
        method: "GET" | "POST" | "PUT" | "DELETE"
        path: string
        auth?: "required" | "optional"
      }
    }
  `,
  config: `
    myAPI: #APISpec & {
      version: "1.0"
      endpoints: {
        users: {
          method: "GET"
          path: "/api/users"
          auth: "required"
        }
        health: {
          method: "GET"
          path: "/health"
        }
      }
    }
  `
});

if (result.valid) {
  console.log('✅ Architecture is valid!');
  console.log('Evaluated config:', result.value);
} else {
  console.log('❌ Validation failed:');
  
  // Get friendly explanations for errors
  const explanations = await client.explain(result.errors);
  for (const explanation of explanations) {
    console.log(`- ${explanation.explanation}`);
    if (explanation.suggestions.length > 0) {
      console.log(`  Suggestions: ${explanation.suggestions.join(', ')}`);
    }
  }
}
```

## Core Features

### 1. Architecture Validation

Validate your architecture configurations against CUE schemas:

```typescript
const result = await client.validateArchitecture({
  schema: '...',     // CUE schema definition
  config: '...',     // Configuration to validate
  requestId: 'req-1', // Optional: for tracking
  strict: true       // Optional: enable strict validation
});

// Check results
console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Violations:', result.violations); // { errors: 0, warnings: 1, info: 0 }
```

### 2. Error Explanation

Get human-friendly explanations for validation errors:

```typescript
const explanations = await client.explain(result.errors);

for (const explanation of explanations) {
  console.log('Error:', explanation.error.message);
  console.log('Explanation:', explanation.explanation);
  console.log('Category:', explanation.category);
  console.log('Suggestions:', explanation.suggestions);
  
  // Code examples (if available)
  if (explanation.examples) {
    for (const example of explanation.examples) {
      console.log(`Before: ${example.before}`);
      console.log(`After: ${example.after}`);
      console.log(`Description: ${example.description}`);
    }
  }
}
```

### 3. Multi-Format Export

Export validated architectures to various formats:

```typescript
// Export to OpenAPI
const openapi = await client.export(validatedConfig, {
  format: 'openapi',
  includeExamples: true,
  strict: false
});

// Export to TypeScript
const typescript = await client.export(validatedConfig, {
  format: 'typescript',
  outputMode: 'single'
});

// Export to Kubernetes
const k8s = await client.export(validatedConfig, {
  format: 'kubernetes',
  config: { namespace: 'production' }
});

console.log('Export successful:', openapi.success);
console.log('Generated output:', openapi.output);
console.log('Metadata:', openapi.metadata);
```

### 4. Real-time Updates (WebSocket)

Connect to receive real-time validation updates:

```typescript
await client.connectWebSocket({
  enabled: true,
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    delay: 1000
  }
}, {
  onValidationResult: (result) => {
    console.log('Real-time validation result:', result);
  },
  onConnectionChange: (connected) => {
    console.log('WebSocket connection:', connected ? 'connected' : 'disconnected');
  },
  onError: (error) => {
    console.error('WebSocket error:', error);
  }
});
```

## Configuration Options

### Client Options

```typescript
interface ClientOptions {
  /** Base URL for the Arbiter server (default: http://localhost:3000) */
  baseUrl?: string;
  /** API key for authentication (if required) */
  apiKey?: string;
  /** Custom client identifier for rate limiting */
  clientId?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    maxRetries?: number;     // default: 3
    baseDelay?: number;      // default: 1000ms
    maxDelay?: number;       // default: 10000ms
    backoffFactor?: number;  // default: 2
    jitter?: number;         // default: 0.1
  };
  /** Enable debug logging */
  debug?: boolean;
}
```

### Retry and Error Handling

The SDK includes robust retry logic with exponential backoff:

```typescript
import { ArbiterClient, NetworkError, TimeoutError, RateLimitError } from '@arbiter/sdk';

const client = new ArbiterClient({
  retry: {
    maxRetries: 5,
    baseDelay: 1000,      // Start with 1s delay
    maxDelay: 30000,      // Cap at 30s delay
    backoffFactor: 2,     // Double delay each retry
    jitter: 0.1           // Add 10% random jitter
  }
});

try {
  const result = await client.validateArchitecture(options);
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log('Rate limited, retry after:', error.retryAfter);
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out after:', error.timeoutMs);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.statusCode, error.response);
  }
}
```

## Server Compatibility

Check compatibility with your Arbiter server:

```typescript
const compatibility = await client.checkCompatibility();

console.log('SDK Version:', compatibility.sdkVersion);
console.log('Server Version:', compatibility.serverVersion);
console.log('Protocol Version:', compatibility.protocolVersion);
console.log('Compatible:', compatibility.compatible);
console.log('Available Features:', compatibility.features);

if (!compatibility.compatible) {
  console.warn('Compatibility issues:', compatibility.messages);
}
```

## Export Formats

Get available export formats:

```typescript
const formats = await client.getSupportedFormats();

for (const format of formats) {
  console.log(`${format.format}: ${format.description}`);
}
```

Supported formats:
- **openapi**: OpenAPI 3.1 specification
- **typescript**: TypeScript type definitions
- **kubernetes**: Kubernetes resource manifests
- **terraform**: Terraform configuration files
- **json-schema**: JSON Schema definitions

## Advanced Usage

### Custom Error Translation

Extend error explanations for your domain:

```typescript
const errors = result.errors;
const explanations = await client.explain(errors);

// Add domain-specific context
const enhancedExplanations = explanations.map(exp => ({
  ...exp,
  domainContext: getDomainContext(exp.error),
  fixPriority: calculatePriority(exp.category),
}));
```

### Batch Operations

Validate multiple configurations:

```typescript
const configurations = [
  { schema: schema1, config: config1 },
  { schema: schema2, config: config2 },
  { schema: schema3, config: config3 },
];

const results = await Promise.allSettled(
  configurations.map(config => 
    client.validateArchitecture(config)
  )
);

const validConfigs = results
  .filter((result, index) => 
    result.status === 'fulfilled' && result.value.valid
  )
  .map((result, index) => configurations[index]);
```

### Performance Monitoring

Track SDK performance:

```typescript
const client = new ArbiterClient({ debug: true });

// Measure validation time
const start = Date.now();
const result = await client.validateArchitecture(options);
const duration = Date.now() - start;

console.log(`Validation completed in ${duration}ms`);
console.log(`Found ${result.violations.errors} errors, ${result.violations.warnings} warnings`);
```

## Error Handling Best Practices

1. **Always handle specific error types**:
   ```typescript
   try {
     const result = await client.validateArchitecture(options);
   } catch (error) {
     if (error instanceof RateLimitError) {
       // Implement exponential backoff
     } else if (error instanceof ValidationError) {
       // Handle validation-specific errors
     } else if (error instanceof NetworkError) {
       // Handle network issues
     }
   }
   ```

2. **Use retry configuration appropriately**:
   ```typescript
   // For CI/CD: Quick failures
   const ciClient = new ArbiterClient({
     timeout: 10000,
     retry: { maxRetries: 2, baseDelay: 500 }
   });

   // For development: More resilient
   const devClient = new ArbiterClient({
     timeout: 30000,
     retry: { maxRetries: 5, baseDelay: 1000 }
   });
   ```

3. **Implement proper logging**:
   ```typescript
   const client = new ArbiterClient({
     debug: process.env.NODE_ENV === 'development'
   });
   ```

## Protocol Versions

| SDK Version | Protocol Version | Server Compatibility |
|-------------|------------------|---------------------|
| 0.1.x       | 1.0             | Arbiter Server 1.0+ |

The SDK automatically checks protocol compatibility on connection and will warn about version mismatches.

## TypeScript Support

This SDK is written in TypeScript and provides full type safety:

```typescript
import type { 
  ValidationResult, 
  ExplainResult, 
  ExportResult,
  CompatibilityInfo 
} from '@arbiter/sdk';

// All interfaces are exported for custom implementations
const customValidator = (result: ValidationResult): boolean => {
  return result.valid && result.violations.errors === 0;
};
```

## Contributing

See the main [Arbiter repository](https://github.com/nathanrice/arbiter) for contribution guidelines.

## License

MIT © Nathan Rice