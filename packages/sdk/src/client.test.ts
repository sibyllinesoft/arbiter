import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { ArbiterClient } from './client.js';
import { NetworkError, ValidationError, TimeoutError } from './errors.js';

// Mock fetch globally
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // Reset fetch mock before each test
  globalThis.fetch = mock(() => Promise.resolve(new Response()));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('ArbiterClient', () => {
  test('should create client with default options', () => {
    const client = new ArbiterClient();
    expect(client).toBeInstanceOf(ArbiterClient);
  });

  test('should create client with custom options', () => {
    const client = new ArbiterClient({
      baseUrl: 'http://localhost:4000',
      timeout: 5000,
      clientId: 'test-client',
      debug: true,
    });
    expect(client).toBeInstanceOf(ArbiterClient);
  });

  describe('validateArchitecture', () => {
    test('should validate architecture successfully', async () => {
      const mockResponse = {
        requestId: 'test-request',
        errors: [],
        value: { valid: true },
        graph: [],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      const result = await client.validateArchitecture({
        schema: 'mySchema: string',
        config: 'mySchema: "test"',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.violations.errors).toBe(0);
    });

    test('should handle validation errors', async () => {
      const mockResponse = {
        requestId: 'test-request',
        errors: [
          {
            message: 'Type mismatch',
            line: 1,
            column: 10,
            severity: 'error',
          },
        ],
        value: null,
        graph: [],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      const result = await client.validateArchitecture({
        schema: 'mySchema: number',
        config: 'mySchema: "text"',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.violations.errors).toBe(1);
    });

    test('should retry on network errors', async () => {
      let callCount = 0;
      globalThis.fetch = mock(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(new Response(JSON.stringify({
          requestId: 'test-request',
          errors: [],
          value: { valid: true },
          graph: [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }));
      });

      const client = new ArbiterClient({
        retry: { maxRetries: 3, baseDelay: 10 }
      });
      
      const result = await client.validateArchitecture({
        schema: 'mySchema: string',
        config: 'mySchema: "test"',
      });

      expect(result.valid).toBe(true);
      expect(callCount).toBe(3);
    });

    test('should timeout on slow requests', async () => {
      globalThis.fetch = mock(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const client = new ArbiterClient({ timeout: 100 });
      
      await expect(client.validateArchitecture({
        schema: 'mySchema: string',
        config: 'mySchema: "test"',
      })).rejects.toThrow(TimeoutError);
    });

    test('should handle rate limiting', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { 'Retry-After': '60' },
        }))
      );

      const client = new ArbiterClient();
      
      await expect(client.validateArchitecture({
        schema: 'mySchema: string',
        config: 'mySchema: "test"',
      })).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('explain', () => {
    test('should explain errors', async () => {
      const client = new ArbiterClient();
      const errors = [
        {
          message: 'conflicting values 42 and "hello"',
          line: 1,
          column: 10,
          severity: 'error' as const,
        },
      ];

      const results = await client.explain(errors);
      
      expect(results).toHaveLength(1);
      expect(results[0].error).toBe(errors[0]);
      expect(results[0].explanation).toBeDefined();
      expect(results[0].suggestions).toBeDefined();
      expect(results[0].category).toBeDefined();
    });
  });

  describe('export', () => {
    test('should export to OpenAPI', async () => {
      const mockResponse = {
        success: true,
        output: '{"openapi": "3.1.0"}',
        warnings: [],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      const result = await client.export('myAPI: {...}', {
        format: 'openapi',
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('openapi');
      expect(result.output).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    test('should handle export errors', async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({
          success: false,
          error: 'Invalid schema format',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      
      await expect(client.export('invalid schema', {
        format: 'openapi',
      })).rejects.toThrow(NetworkError);
    });
  });

  describe('checkCompatibility', () => {
    test('should check server compatibility', async () => {
      const mockResponse = {
        status: 'healthy',
        version: '1.0.0',
        protocolVersion: '1.0',
        timestamp: new Date().toISOString(),
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      const compatibility = await client.checkCompatibility();

      expect(compatibility.compatible).toBe(true);
      expect(compatibility.serverVersion).toBe('1.0.0');
      expect(compatibility.protocolVersion).toBe('1.0');
      expect(compatibility.sdkVersion).toBeDefined();
      expect(compatibility.features).toBeDefined();
    });

    test('should detect incompatible versions', async () => {
      const mockResponse = {
        status: 'healthy',
        version: '2.0.0',
        protocolVersion: '2.0',
        timestamp: new Date().toISOString(),
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      const compatibility = await client.checkCompatibility();

      expect(compatibility.compatible).toBe(false);
      expect(compatibility.messages?.length).toBeGreaterThan(0);
    });
  });

  describe('getSupportedFormats', () => {
    test('should get supported export formats', async () => {
      const mockResponse = {
        success: true,
        formats: [
          { format: 'openapi', description: 'OpenAPI 3.1 specification' },
          { format: 'typescript', description: 'TypeScript type definitions' },
          { format: 'kubernetes', description: 'Kubernetes resource manifests' },
        ],
      };

      globalThis.fetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      );

      const client = new ArbiterClient();
      const formats = await client.getSupportedFormats();

      expect(formats).toHaveLength(3);
      expect(formats[0].format).toBe('openapi');
      expect(formats[0].description).toBeDefined();
    });
  });
});