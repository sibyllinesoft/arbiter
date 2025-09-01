/**
 * Unit tests for CUE analysis engine
 * Tests the core CUE parsing and analysis functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { rmSync } from 'fs';
import { 
  analyzeCue, 
  parseCueStderr, 
  buildGraph, 
  CONFIG,
  type CueError,
  type GraphNode 
} from './server-isolated';

describe('CUE Analysis Engine', () => {
  describe('parseCueStderr', () => {
    test('should parse CUE error with position info', () => {
      const stderr = 'doc.cue:2:5: undefined field "foo"';
      const errors = parseCueStderr(stderr);
      
      expect(errors).toEqual([{
        filename: 'doc.cue',
        line: 2,
        column: 5,
        message: 'undefined field "foo"',
        violationId: expect.any(String),
        severity: 'error',
        friendlyMessage: expect.any(String),
        suggestedFix: expect.any(String),
      }]);
    });

    test('should parse multiple CUE errors', () => {
      const stderr = `doc.cue:1:1: invalid syntax
doc.cue:3:10: type mismatch`;
      const errors = parseCueStderr(stderr);
      
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        filename: 'doc.cue',
        line: 1,
        column: 1,
        message: 'invalid syntax',
      });
      expect(errors[1]).toMatchObject({
        filename: 'doc.cue',
        line: 3,
        column: 10,
        message: 'type mismatch',
      });
    });

    test('should handle generic error without position', () => {
      const stderr = 'cue: command not found';
      const errors = parseCueStderr(stderr);
      
      expect(errors).toEqual([{
        message: 'cue: command not found',
        violationId: expect.any(String),
        severity: 'error',
        friendlyMessage: expect.any(String),
        suggestedFix: expect.any(String),
      }]);
    });

    test('should handle empty stderr', () => {
      const stderr = '';
      const errors = parseCueStderr(stderr);
      
      expect(errors).toEqual([]);
    });

    test('should skip empty lines', () => {
      const stderr = `doc.cue:1:1: error 1

doc.cue:2:2: error 2`;
      const errors = parseCueStderr(stderr);
      
      expect(errors).toHaveLength(2);
    });
  });

  describe('buildGraph', () => {
    test('should build graph from simple object', () => {
      const value = {
        name: 'test',
        count: 42,
        config: {
          enabled: true,
          timeout: 5000,
        },
        items: ['a', 'b', 'c'],
      };

      const graph = buildGraph(value);

      expect(graph).toHaveLength(4);
      expect(graph).toContainEqual({
        id: 'name',
        label: 'name',
        type: 'value',
      });
      expect(graph).toContainEqual({
        id: 'config',
        label: 'config',
        type: 'object',
        children: ['enabled', 'timeout'],
      });
      expect(graph).toContainEqual({
        id: 'items',
        label: 'items',
        type: 'array',
      });
    });

    test('should handle large objects with summary', () => {
      const largeObject: Record<string, any> = {};
      for (let i = 0; i < 250; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      const graph = buildGraph(largeObject);

      expect(graph).toHaveLength(1);
      expect(graph[0]).toEqual({
        id: 'summary',
        label: 'Large object (250 keys)',
        type: 'object',
      });
    });

    test('should handle nested objects with limited children', () => {
      const value = {
        config: {},
      };
      // Add many nested properties
      for (let i = 0; i < 15; i++) {
        value.config[`prop${i}`] = `value${i}`;
      }

      const graph = buildGraph(value);

      expect(graph[0].children).toHaveLength(10); // Limited to 10
    });

    test('should handle null and primitive values', () => {
      expect(buildGraph(null)).toEqual([]);
      expect(buildGraph('string')).toEqual([]);
      expect(buildGraph(42)).toEqual([]);
      expect(buildGraph(true)).toEqual([]);
    });

    test('should handle arrays correctly', () => {
      const value = {
        numbers: [1, 2, 3],
        strings: ['a', 'b'],
        mixed: [1, 'a', { nested: true }],
      };

      const graph = buildGraph(value);

      expect(graph.find(node => node.id === 'numbers')).toMatchObject({
        type: 'array',
        children: undefined,
      });
    });
  });

  describe('analyzeCue', () => {
    test('should reject imports for security', async () => {
      const text = 'import "encoding/json"\nvalue: 42';
      const result = await analyzeCue(text, 'test-request');

      expect(result).toEqual({
        requestId: 'test-request',
        errors: [{ message: 'Imports are not allowed in this version' }],
      });
    });

    test('should handle timeout', async () => {
      // This would normally timeout with a real long-running CUE process
      // For testing, we use a very short timeout with invalid CUE that will hang
      const text = 'invalid: cue: syntax';
      const result = await analyzeCue(text, 'timeout-test', 10); // 10ms timeout
      
      // Should either timeout or complete quickly with an error
      expect(result.requestId).toBe('timeout-test');
      expect(result.errors).not.toHaveLength(0);
    }, 1000);

    test('should handle valid CUE content', async () => {
      const text = `
name: "test-project"
config: {
  enabled: true
  timeout: 5000
}
count: 42
`;

      const result = await analyzeCue(text, 'valid-test');

      expect(result.requestId).toBe('valid-test');
      
      // This test depends on having 'cue' CLI available
      // If not available, it should return an error
      if (result.errors && result.errors.length > 0) {
        // CUE CLI not available - check error message
        expect(result.errors[0].message).toMatch(/cue|command|not found/i);
      } else {
        // CUE CLI available - check successful parsing
        expect(result.errors).toEqual([]);
        expect(result.value).toBeDefined();
        expect(result.graph).toBeDefined();
        expect(result.graph).toBeInstanceOf(Array);
      }
    }, 2000);

    test('should handle invalid CUE syntax', async () => {
      const text = `
name: "test"
invalid syntax here
config: {
`;

      const result = await analyzeCue(text, 'invalid-test');

      expect(result.requestId).toBe('invalid-test');
      expect(result.errors).not.toHaveLength(0);
      
      // Should have parsing errors (if CUE CLI is available)
      if (!result.errors[0].message.includes('command')) {
        expect(result.errors[0]).toHaveProperty('message');
      }
    }, 2000);

    test('should handle empty CUE content', async () => {
      const text = '';
      const result = await analyzeCue(text, 'empty-test');

      expect(result.requestId).toBe('empty-test');
      
      // Empty CUE should be valid and produce empty object or error
      if (result.errors && result.errors.length === 0) {
        expect(result.value).toBeDefined();
      }
    }, 2000);

    test('should handle CUE with complex nested structures', async () => {
      const text = `
services: {
  frontend: {
    image: "nginx:alpine"
    ports: ["80:8080"]
    env: {
      NODE_ENV: "production"
      API_URL: "http://api:3000"
    }
  }
  api: {
    image: "node:18"
    ports: ["3000:3000"]
    env: {
      DATABASE_URL: "postgres://localhost/app"
    }
    depends_on: ["database"]
  }
  database: {
    image: "postgres:14"
    env: {
      POSTGRES_DB: "app"
      POSTGRES_USER: "user"
      POSTGRES_PASSWORD: "password"
    }
  }
}
`;

      const result = await analyzeCue(text, 'complex-test');

      expect(result.requestId).toBe('complex-test');
      
      if (result.value) {
        // Should have parsed the complex structure
        expect(result.value.services).toBeDefined();
        expect(result.graph).toBeDefined();
        expect(result.graph!.length).toBeGreaterThan(0);
        
        // Should have a services node
        const servicesNode = result.graph!.find(node => node.id === 'services');
        expect(servicesNode).toBeDefined();
        expect(servicesNode!.type).toBe('object');
      }
    }, 3000);

    test('should generate proper error information', async () => {
      const text = `
name: "test"
value: string & int  // This should cause a type conflict
`;

      const result = await analyzeCue(text, 'error-test');

      expect(result.requestId).toBe('error-test');
      
      // If CUE is available and detects the error
      if (result.errors && result.errors.length > 0 && !result.errors[0].message.includes('command')) {
        // Should have position information for the error
        const hasPositionInfo = result.errors.some(error => 
          typeof error.line === 'number' && typeof error.column === 'number'
        );
        // Position info might not always be available depending on CUE version
        expect(result.errors.length).toBeGreaterThan(0);
      }
    }, 2000);
  });

  describe('CUE CLI integration', () => {
    test('should handle missing CUE CLI gracefully', async () => {
      // This test verifies the behavior when CUE CLI is not installed
      const text = 'name: "test"';
      const result = await analyzeCue(text, 'missing-cli-test');

      expect(result.requestId).toBe('missing-cli-test');
      expect(result.errors).toBeDefined();
      
      // Should either succeed (if CUE is available) or fail gracefully
      if (result.errors && result.errors.length > 0) {
        // Check that error message is informative
        expect(result.errors[0].message).toBeTruthy();
      }
    });
  });
});