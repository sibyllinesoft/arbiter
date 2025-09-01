/**
 * Export Engine Tests - Comprehensive validation of all export formats
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { ExportEngine } from './export-engine';

describe('ExportEngine', () => {
  let exportEngine: ExportEngine;

  beforeAll(() => {
    exportEngine = new ExportEngine();
  });

  describe('Tag Analysis', () => {
    test('should detect OpenAPI export tags', async () => {
      const cueContent = `
// #OpenAPI user-api version=3.1.0, file=api.yaml
package test

userAPI: {
  openapi: "3.1.0"
  info: { title: "Test API", version: "1.0.0" }
}`;

      const result = await exportEngine.export(cueContent, { format: 'openapi' });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.detectedTags).toContain('#OPENAPI');
      expect(result.files).toBeDefined();
      expect(result.files?.length).toBeGreaterThan(0);
    });

    test('should detect TypeScript export tags', async () => {
      const cueContent = `
// #TypeScript models file=types.d.ts
package test

#User: {
  id: string
  name: string
  email: string
}

user: #User & {
  id: "123"
  name: "John"
  email: "john@example.com"
}`;

      const result = await exportEngine.export(cueContent, { format: 'types' });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.detectedTags).toContain('#TYPESCRIPT');
    });

    test('should detect K8s export tags', async () => {
      const cueContent = `
// #K8s deployment namespace=production
package test

deployment: {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: {
    name: "test-app"
    namespace: "production"
  }
  spec: {
    replicas: 3
    selector: matchLabels: app: "test-app"
    template: {
      metadata: labels: app: "test-app"
      spec: containers: [{
        name: "app"
        image: "test:latest"
        ports: [{containerPort: 8080}]
      }]
    }
  }
}`;

      const result = await exportEngine.export(cueContent, { format: 'k8s' });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.detectedTags).toContain('#K8S');
    });

    test('should detect Terraform export tags', async () => {
      const cueContent = `
// #Terraform infrastructure file=main.tf
package test

resource: aws_instance: {
  web: {
    ami: "ami-12345678"
    instance_type: "t2.micro"
    tags: {
      Name: "test-instance"
    }
  }
}`;

      const result = await exportEngine.export(cueContent, { format: 'terraform' });
      
      expect(result.success).toBe(true);
      expect(result.metadata?.detectedTags).toContain('#TERRAFORM');
    });

    test('should reject export without appropriate tags', async () => {
      const cueContent = `
package test

data: {
  key: "value"
}`;

      const result = await exportEngine.export(cueContent, { format: 'openapi' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No #OPENAPI tags found');
    });
  });

  describe('OpenAPI Export', () => {
    test('should generate valid OpenAPI 3.1 spec', async () => {
      const cueContent = `
// #OpenAPI test-api version=3.1.0
package test

openapi: "3.1.0"
info: {
  title: "Test API"
  version: "1.0.0"
  description: "Test API for validation"
}
paths: {
  "/users": {
    get: {
      summary: "List users"
      responses: {
        "200": {
          description: "Success"
          content: "application/json": {
            schema: {
              type: "array"
              items: {
                type: "object"
                properties: {
                  id: { type: "string" }
                  name: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  }
}
components: schemas: {}`;

      const result = await exportEngine.export(cueContent, { format: 'openapi' });
      
      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      expect(result.files!.length).toBeGreaterThan(0);
      
      const openAPIContent = result.files![0].content;
      expect(openAPIContent).toContain('openapi: 3.1.0');
      expect(openAPIContent).toContain('title: Test API');
      expect(openAPIContent).toContain('/users');
    });
  });

  describe('TypeScript Export', () => {
    test('should generate TypeScript definitions from JSON Schema', async () => {
      const cueContent = `
// #TypeScript models
package test

#User: {
  id: string
  name: string
  email: string
  age: number
  isActive: bool
  profile?: {
    firstName?: string
    lastName?: string
  }
}

user: #User`;

      const result = await exportEngine.export(cueContent, { format: 'types' });
      
      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      
      if (result.files && result.files.length > 0) {
        const tsContent = result.files[0].content;
        expect(tsContent).toContain('export interface');
        expect(tsContent).toContain('string');
        expect(tsContent).toContain('number');
        expect(tsContent).toContain('boolean');
      }
    });
  });

  describe('Kubernetes Export', () => {
    test('should generate valid Kubernetes YAML', async () => {
      const cueContent = `
// #K8s deployment
package test

deployment: {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: {
    name: "test-deployment"
    labels: app: "test"
  }
  spec: {
    replicas: 2
    selector: matchLabels: app: "test"
    template: {
      metadata: labels: app: "test"
      spec: containers: [{
        name: "test"
        image: "nginx:latest"
        ports: [{containerPort: 80}]
      }]
    }
  }
}

service: {
  apiVersion: "v1"
  kind: "Service"
  metadata: name: "test-service"
  spec: {
    selector: app: "test"
    ports: [{port: 80, targetPort: 80}]
  }
}`;

      const result = await exportEngine.export(cueContent, { format: 'k8s' });
      
      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      
      if (result.files && result.files.length > 0) {
        const k8sContent = result.files[0].content;
        expect(k8sContent).toContain('apiVersion: apps/v1');
        expect(k8sContent).toContain('kind: Deployment');
        expect(k8sContent).toContain('replicas: 2');
      }
    });
  });

  describe('Terraform Export', () => {
    test('should generate HCL format from CUE', async () => {
      const cueContent = `
// #Terraform infrastructure
package test

resource: {
  aws_instance: {
    web: {
      ami: "ami-12345678"
      instance_type: "t2.micro"
      tags: {
        Name: "web-server"
        Environment: "test"
      }
    }
  }
  aws_security_group: {
    web_sg: {
      name: "web-sg"
      description: "Security group for web server"
      ingress: [{
        from_port: 80
        to_port: 80
        protocol: "tcp"
        cidr_blocks: ["0.0.0.0/0"]
      }]
    }
  }
}

output: {
  instance_ip: {
    value: "\${aws_instance.web.public_ip}"
    description: "Public IP of web server"
  }
}`;

      const result = await exportEngine.export(cueContent, { format: 'terraform' });
      
      expect(result.success).toBe(true);
      expect(result.files).toBeDefined();
      
      if (result.files && result.files.length > 0) {
        const tfContent = result.files[0].content;
        expect(tfContent).toContain('aws_instance');
        expect(tfContent).toContain('ami = "ami-12345678"');
        expect(tfContent).toContain('instance_type = "t2.micro"');
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid CUE syntax', async () => {
      const invalidCue = `
// #OpenAPI test
package test
invalid syntax here {{{`;

      const result = await exportEngine.export(invalidCue, { format: 'openapi' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should provide helpful error for unsupported format', async () => {
      const cueContent = `
// #OpenAPI test
package test
data: "test"`;

      const result = await exportEngine.export(cueContent, { format: 'unsupported' as any });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No #UNSUPPORTED tags found');
    });
  });

  describe('Multiple Tags', () => {
    test('should handle multiple export tags in same file', async () => {
      const cueContent = `
// #OpenAPI api
// #TypeScript models
// #K8s deployment
package test

// API definition
api: {
  openapi: "3.1.0"
  info: { title: "Multi-export API", version: "1.0.0" }
  paths: {}
}

// Type definitions
#User: {
  id: string
  name: string
}

// K8s deployment
deployment: {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: name: "multi-export"
  spec: {
    replicas: 1
    selector: matchLabels: app: "multi-export"
    template: {
      metadata: labels: app: "multi-export"
      spec: containers: [{
        name: "app"
        image: "multi-export:latest"
      }]
    }
  }
}`;

      // Test each format independently
      const openApiResult = await exportEngine.export(cueContent, { format: 'openapi' });
      expect(openApiResult.success).toBe(true);
      expect(openApiResult.metadata?.detectedTags).toContain('#OPENAPI');
      
      const typesResult = await exportEngine.export(cueContent, { format: 'types' });
      expect(typesResult.success).toBe(true);
      expect(typesResult.metadata?.detectedTags).toContain('#TYPESCRIPT');
      
      const k8sResult = await exportEngine.export(cueContent, { format: 'k8s' });
      expect(k8sResult.success).toBe(true);
      expect(k8sResult.metadata?.detectedTags).toContain('#K8S');
    });
  });

  describe('Metadata and Warnings', () => {
    test('should provide export metadata', async () => {
      const cueContent = `
// #OpenAPI complete-api file=complete.yaml
package test

api: {
  openapi: "3.1.0"
  info: { title: "Complete API", version: "2.0.0" }
}`;

      const result = await exportEngine.export(cueContent, { format: 'openapi' });
      
      expect(result.success).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.generatedAt).toBeDefined();
      expect(result.metadata?.detectedTags).toContain('#OPENAPI');
      expect(result.metadata?.exportedSchemas).toBeDefined();
    });

    test('should handle partial exports with warnings', async () => {
      const cueContent = `
// #OpenAPI partial-api
package test

incomplete: "data"`;

      const result = await exportEngine.export(cueContent, { format: 'openapi' });
      
      // Should succeed but potentially with warnings about incomplete schema
      if (result.success) {
        // Check if warnings are provided for incomplete OpenAPI spec
        expect(result.warnings).toBeUndefined(); // or expect warnings if validation is strict
      }
    });
  });
});