#!/usr/bin/env node

/**
 * Quick validation demo for SDK functionality
 * This simulates the SDK behavior without requiring TypeScript compilation
 */

// Mock SDK functionality for demonstration
class MockArbiterClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.timeout = options.timeout || 30000;
    this.debug = options.debug || false;
    
    if (this.debug) {
      console.log(`🔧 Arbiter Client initialized: ${this.baseUrl}`);
    }
  }

  async validateArchitecture(options) {
    const { schema, config } = options;
    
    console.log(`📝 Validating architecture...`);
    console.log(`   Schema length: ${schema.length} chars`);
    console.log(`   Config length: ${config.length} chars`);
    
    // Simulate validation - check for common issues
    const errors = [];
    
    // Check for invalid URL pattern (simulated validation)
    if (config.includes('baseURL: "invalid-url"')) {
      errors.push({
        message: 'baseURL must match pattern "^https?://"',
        line: 10,
        column: 12,
        severity: 'error',
        friendlyMessage: 'The baseURL field must start with http:// or https://',
        violationId: 'url-format-violation',
      });
    }

    // Check for missing required fields
    if (!config.includes('version:')) {
      errors.push({
        message: 'field version is required',
        line: 3,
        column: 1,
        severity: 'error',
        friendlyMessage: 'The API specification must include a version field',
        violationId: 'missing-required-field',
      });
    }

    const violations = {
      errors: errors.filter(e => e.severity === 'error').length,
      warnings: errors.filter(e => e.severity === 'warning').length,
      info: errors.filter(e => e.severity === 'info').length,
    };

    return {
      requestId: `mock-${Date.now()}`,
      valid: errors.length === 0,
      errors,
      violations,
      value: errors.length === 0 ? { validated: true } : null,
      graph: [
        { id: 'api', label: 'API Specification', type: 'object', children: ['endpoints'] },
        { id: 'endpoints', label: 'Endpoints', type: 'object', children: ['getUsers', 'createUser'] }
      ]
    };
  }

  async explain(errors) {
    console.log(`💡 Generating explanations for ${errors.length} errors...`);
    
    return errors.map(error => ({
      error,
      explanation: error.friendlyMessage || error.message,
      suggestions: this.getSuggestions(error),
      category: this.categorizeError(error),
      documentation: [`https://arbiter.dev/docs/errors/${error.violationId || 'general'}`]
    }));
  }

  getSuggestions(error) {
    if (error.message.includes('baseURL')) {
      return [
        'Use "http://localhost:3000" for local development',
        'Use "https://api.example.com" for production',
        'Ensure the URL includes the protocol (http:// or https://)'
      ];
    }
    
    if (error.message.includes('version')) {
      return [
        'Add version: "1.0.0" to your API specification',
        'Use semantic versioning (major.minor.patch)',
        'Version should be a string, not a number'
      ];
    }

    return ['Check the CUE documentation for proper syntax'];
  }

  categorizeError(error) {
    if (error.message.includes('pattern') || error.message.includes('format')) {
      return 'format-validation';
    }
    if (error.message.includes('required')) {
      return 'missing-field';
    }
    return 'validation-error';
  }

  async export(text, options) {
    console.log(`📤 Exporting to ${options.format}...`);
    
    let output;
    switch (options.format) {
      case 'openapi':
        output = JSON.stringify({
          openapi: '3.1.0',
          info: { title: 'Generated API', version: '1.0.0' },
          paths: { '/api/v1/users': { get: { summary: 'List users' } } }
        }, null, 2);
        break;
      
      case 'typescript':
        output = `// Generated TypeScript interfaces
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}`;
        break;
      
      case 'kubernetes':
        output = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-api
  template:
    metadata:
      labels:
        app: user-api
    spec:
      containers:
      - name: api
        image: user-api:latest
        ports:
        - containerPort: 3000`;
        break;
      
      default:
        output = JSON.stringify({ message: `Export format ${options.format} generated` });
    }

    return {
      success: true,
      format: options.format,
      output,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '0.1.0',
        sourceHash: 'abc123'
      }
    };
  }

  async checkCompatibility() {
    return {
      sdkVersion: '0.1.0',
      serverVersion: '1.0.0',
      protocolVersion: '1.0',
      compatible: true,
      features: {
        validation: true,
        export: true,
        websocket: true,
        realtime: true
      }
    };
  }
}

// Demo data
const schema = `
#APISpec: {
  version: string & =~"^[0-9]+\\.[0-9]+\\.[0-9]+$"
  name: string
  baseURL: string & =~"^https?://"
  endpoints: [string]: {
    method: "GET" | "POST" | "PUT" | "DELETE"
    path: string
    auth: "required" | "optional" | "none"
  }
}
`;

const validConfig = `
userAPI: #APISpec & {
  version: "1.0.0"
  name: "User API"
  baseURL: "https://api.example.com"
  endpoints: {
    getUsers: {
      method: "GET"
      path: "/api/v1/users"
      auth: "required"
    }
  }
}
`;

const invalidConfig = `
userAPI: #APISpec & {
  name: "User API"
  baseURL: "invalid-url"
  endpoints: {
    getUsers: {
      method: "GET"
      path: "/api/v1/users"
      auth: "required"
    }
  }
}
`;

async function runDemo() {
  console.log('🏗️  Arbiter SDK Demo - Sprint 3\n');

  // Initialize client
  const client = new MockArbiterClient({
    baseUrl: 'http://localhost:3000',
    debug: true
  });

  try {
    // 1. Check compatibility
    console.log('1. Checking server compatibility...');
    const compatibility = await client.checkCompatibility();
    console.log(`   SDK: ${compatibility.sdkVersion}, Server: ${compatibility.serverVersion}`);
    console.log(`   Compatible: ${compatibility.compatible ? '✅' : '❌'}`);
    console.log(`   Features: ${Object.keys(compatibility.features).filter(k => compatibility.features[k]).join(', ')}\n`);

    // 2. Test with invalid config
    console.log('2. Validating invalid configuration...');
    const invalidResult = await client.validateArchitecture({
      schema,
      config: invalidConfig
    });
    
    console.log(`   Valid: ${invalidResult.valid ? '✅' : '❌'}`);
    console.log(`   Violations: ${invalidResult.violations.errors} errors, ${invalidResult.violations.warnings} warnings\n`);

    if (!invalidResult.valid) {
      console.log('3. Explaining validation errors...');
      const explanations = await client.explain(invalidResult.errors);
      
      explanations.forEach((explanation, index) => {
        console.log(`   Error ${index + 1}:`);
        console.log(`     ${explanation.explanation}`);
        console.log(`     Suggestions: ${explanation.suggestions.slice(0, 2).join(', ')}`);
        console.log(`     Category: ${explanation.category}\n`);
      });
    }

    // 4. Test with valid config
    console.log('4. Validating corrected configuration...');
    const validResult = await client.validateArchitecture({
      schema,
      config: validConfig
    });
    
    console.log(`   Valid: ${validResult.valid ? '✅' : '❌'}\n`);

    if (validResult.valid) {
      // 5. Export to different formats
      console.log('5. Exporting to different formats...');
      
      const formats = ['openapi', 'typescript', 'kubernetes'];
      for (const format of formats) {
        const result = await client.export(validConfig, { format });
        console.log(`   ✅ ${format} export (${result.output.length} chars)`);
      }
      console.log('');

      // 6. Show graph structure
      console.log('6. Architecture graph structure:');
      validResult.graph?.forEach(node => {
        console.log(`   - ${node.id}: ${node.label} (${node.type})`);
        if (node.children) {
          console.log(`     Children: ${node.children.join(', ')}`);
        }
      });
    }

    console.log('\n✨ SDK Demo completed successfully!');
    console.log('\n🔗 Next Steps:');
    console.log('   1. Start Arbiter server: bun run dev');
    console.log('   2. Create a PR with architecture changes');
    console.log('   3. Watch GitHub Action validate and comment');
    console.log('   4. Download generated export artifacts');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

// Run demo if called directly
runDemo().catch(console.error);

export { MockArbiterClient, runDemo };