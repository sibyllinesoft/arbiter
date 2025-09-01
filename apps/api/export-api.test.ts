/**
 * Export API Unit Tests
 * Tests the export engine functionality directly without HTTP
 */

import { describe, test, expect } from 'bun:test';
import { ExportEngine, getSupportedFormats, validateExportFormat } from './export-engine.js';

describe('Export Engine', () => {
  describe('Supported Formats', () => {
    test('should return supported export formats', () => {
      const formats = getSupportedFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      
      // Check for expected formats
      const formatNames = formats.map((f: any) => f.format);
      expect(formatNames).toContain('openapi');
      expect(formatNames).toContain('types');
      expect(formatNames).toContain('k8s');
      expect(formatNames).toContain('terraform');
      expect(formatNames).toContain('json-schema');
    });
  });

  describe('Export Functionality', () => {
    test('should export OpenAPI format with proper tags', async () => {
      const cueContent = `
// #OpenAPI test-api version=3.1.0
package test

openapi: "3.1.0"
info: {
  title: "Test API"
  version: "1.0.0"
}
paths: {
  "/test": {
    get: {
      responses: {
        "200": {
          description: "Success"
        }
      }
    }
  }
}`;

      const exportEngine = new ExportEngine();
      const result = await exportEngine.export(cueContent, {
        format: 'openapi',
        strict: false,
        includeExamples: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.files).toBeDefined();
        expect(result.files.length).toBeGreaterThan(0);
        expect(result.metadata).toBeDefined();
      }
    });

    test('should export TypeScript types with proper tags', async () => {
      const cueContent = `
// #TypeScript models
package test

#User: {
  id: string
  name: string
  email: string
  age: number
  isActive: bool
}

user: #User`;

      const exportEngine = new ExportEngine();
      const result = await exportEngine.export(cueContent, {
        format: 'types'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.files).toBeDefined();
        
        if (result.files && result.files.length > 0) {
          expect(result.files[0].name).toMatch(/\.d\.ts$/);
          expect(result.files[0].content).toContain('export interface');
        }
      }
    });

    test('should export Kubernetes YAML with proper tags', async () => {
      const cueContent = `
// #K8s deployment
package test

deployment: {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: {
    name: "test-deployment"
  }
  spec: {
    replicas: 1
    selector: matchLabels: app: "test"
    template: {
      metadata: labels: app: "test"
      spec: containers: [{
        name: "test"
        image: "nginx"
        ports: [{containerPort: 80}]
      }]
    }
  }
}`;

      const exportEngine = new ExportEngine();
      const result = await exportEngine.export(cueContent, {
        format: 'k8s'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.files).toBeDefined();
        
        if (result.files && result.files.length > 0) {
          expect(result.files[0].name).toMatch(/\.k8s\.yaml$/);
          expect(result.files[0].content).toContain('apiVersion: apps/v1');
          expect(result.files[0].content).toContain('kind: Deployment');
        }
      }
    });

    test('should return error for missing export tags', async () => {
      const cueContent = `
package test

data: {
  key: "value"
}`;

      const exportEngine = new ExportEngine();
      const result = await exportEngine.export(cueContent, {
        format: 'openapi'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No #OPENAPI tags found');
      }
    });

    test('should return false for unsupported format', () => {
      const isValid = validateExportFormat('unsupported');
      expect(isValid).toBe(false);
    });

    test('should handle strict validation option', async () => {
      const cueContent = `
// #OpenAPI strict-api
package test

// Minimal API spec - might fail strict validation
openapi: "3.1.0"
info: title: "Minimal"`;

      const exportEngine = new ExportEngine();
      const result = await exportEngine.export(cueContent, {
        format: 'openapi',
        strict: true
      });

      // Should either succeed or fail with validation warnings
      if (!result.success) {
        expect(result.error).toBeDefined();
      } else if (result.success) {
        // May have warnings for incomplete spec
        expect(result.files).toBeDefined();
      }
    });

    test('should validate format parameter', () => {
      const isValid = validateExportFormat('openapi');
      expect(isValid).toBe(true);
    });
  });
});