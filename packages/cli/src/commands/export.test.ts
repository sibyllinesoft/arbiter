/**
 * Export Command Integration Tests
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn } from 'bun';
import fs from 'fs-extra';
import path from 'path';
import { tmpdir } from 'os';

describe('Export Command', () => {
  let testDir: string;
  let cliPath: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'arbiter-export-test-'));
    
    // Build CLI (in real setup, this would be pre-built)
    cliPath = 'bun run packages/cli/src/cli.ts';
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.remove(testDir);
  });

  describe('Format Listing', () => {
    test('should list available export formats', async () => {
      const proc = spawn({
        cmd: cliPath.split(' ').concat(['export', '--list-formats']),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        console.log('STDERR:', stderr);
      }

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain('Available export formats');
      expect(stdout).toContain('openapi');
      expect(stdout).toContain('types');
      expect(stdout).toContain('k8s');
      expect(stdout).toContain('terraform');
      expect(stdout).toContain('#OpenAPI');
      expect(stdout).toContain('#TypeScript');
    });
  });

  describe('OpenAPI Export', () => {
    test('should export OpenAPI from tagged CUE file', async () => {
      const cueFile = path.join(testDir, 'api.cue');
      const cueContent = `
// #OpenAPI user-api version=3.1.0, file=user-api.yaml
package api

openapi: "3.1.0"
info: {
  title: "User API"
  version: "1.0.0"
  description: "User management API"
}
servers: [{
  url: "https://api.example.com"
  description: "Production server"
}]
paths: {
  "/users": {
    get: {
      summary: "List users"
      operationId: "listUsers"
      responses: {
        "200": {
          description: "List of users"
          content: "application/json": {
            schema: {
              type: "array"
              items: {
                $ref: "#/components/schemas/User"
              }
            }
          }
        }
      }
    }
    post: {
      summary: "Create user"
      operationId: "createUser"
      requestBody: {
        required: true
        content: "application/json": {
          schema: {
            $ref: "#/components/schemas/CreateUserRequest"
          }
        }
      }
      responses: {
        "201": {
          description: "User created"
          content: "application/json": {
            schema: {
              $ref: "#/components/schemas/User"
            }
          }
        }
      }
    }
  }
  "/users/{id}": {
    get: {
      summary: "Get user by ID"
      operationId: "getUserById"
      parameters: [{
        name: "id"
        in: "path"
        required: true
        schema: { type: "string" }
      }]
      responses: {
        "200": {
          description: "User details"
          content: "application/json": {
            schema: {
              $ref: "#/components/schemas/User"
            }
          }
        }
        "404": {
          description: "User not found"
        }
      }
    }
  }
}
components: {
  schemas: {
    User: {
      type: "object"
      properties: {
        id: { type: "string" }
        name: { type: "string" }
        email: { type: "string", format: "email" }
        createdAt: { type: "string", format: "date-time" }
      }
      required: ["id", "name", "email"]
    }
    CreateUserRequest: {
      type: "object"
      properties: {
        name: { type: "string" }
        email: { type: "string", format: "email" }
      }
      required: ["name", "email"]
    }
  }
}`;

      await fs.writeFile(cueFile, cueContent);

      const outputFile = path.join(testDir, 'output.yaml');

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'openapi',
          '--output', outputFile,
          '--verbose'
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
      }

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain('✓ Exported openapi');

      // Check output file exists and contains expected content
      const outputExists = await fs.pathExists(outputFile);
      expect(outputExists).toBe(true);

      if (outputExists) {
        const outputContent = await fs.readFile(outputFile, 'utf-8');
        expect(outputContent).toContain('openapi: "3.1.0"');
        expect(outputContent).toContain('User API');
        expect(outputContent).toContain('/users');
        expect(outputContent).toContain('components:');
        expect(outputContent).toContain('schemas:');
      }
    });
  });

  describe('TypeScript Export', () => {
    test('should export TypeScript types from tagged CUE file', async () => {
      const cueFile = path.join(testDir, 'types.cue');
      const cueContent = `
// #TypeScript models file=types.d.ts
package models

#User: {
  id: string
  name: string
  email: string
  age: number
  isActive: bool
  profile?: {
    firstName?: string
    lastName?: string
    avatar?: string
  }
  addresses: [...#Address]
  metadata: [string]: string
  createdAt: string
  updatedAt: string
}

#Address: {
  id: string
  street: string
  city: string
  state: string
  zipCode: string
  country: string | *"US"
  isPrimary: bool
}

#CreateUserRequest: {
  name: string
  email: string
  age: number
  profile?: #User.profile
}

#UpdateUserRequest: {
  name?: string
  email?: string
  age?: number
  isActive?: bool
  profile?: #User.profile
}

// Export the types
user: #User
createUserRequest: #CreateUserRequest
updateUserRequest: #UpdateUserRequest`;

      await fs.writeFile(cueFile, cueContent);

      const outputFile = path.join(testDir, 'types.d.ts');

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'types',
          '--output', outputFile
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
      }

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain('✓ Exported types');

      // Check output file exists and contains expected content
      const outputExists = await fs.pathExists(outputFile);
      expect(outputExists).toBe(true);

      if (outputExists) {
        const outputContent = await fs.readFile(outputFile, 'utf-8');
        expect(outputContent).toContain('export interface');
        expect(outputContent).toContain('string');
        expect(outputContent).toContain('number');
        expect(outputContent).toContain('boolean');
        // Should have optional properties marked with ?
        expect(outputContent).toMatch(/\w+\?:/);
      }
    });
  });

  describe('Kubernetes Export', () => {
    test('should export Kubernetes YAML from tagged CUE file', async () => {
      const cueFile = path.join(testDir, 'k8s.cue');
      const cueContent = `
// #K8s deployment namespace=production
package k8s

deployment: {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: {
    name: "web-app"
    namespace: "production"
    labels: {
      app: "web-app"
      version: "v1.0.0"
      component: "backend"
    }
  }
  spec: {
    replicas: 3
    strategy: {
      type: "RollingUpdate"
      rollingUpdate: {
        maxUnavailable: 1
        maxSurge: 1
      }
    }
    selector: {
      matchLabels: {
        app: "web-app"
        component: "backend"
      }
    }
    template: {
      metadata: {
        labels: {
          app: "web-app"
          component: "backend"
        }
      }
      spec: {
        containers: [{
          name: "web-app"
          image: "web-app:1.0.0"
          ports: [{
            containerPort: 8080
            name: "http"
            protocol: "TCP"
          }]
          env: [
            {
              name: "NODE_ENV"
              value: "production"
            },
            {
              name: "DB_HOST"
              valueFrom: {
                secretKeyRef: {
                  name: "app-secrets"
                  key: "db-host"
                }
              }
            }
          ]
          resources: {
            requests: {
              cpu: "100m"
              memory: "128Mi"
            }
            limits: {
              cpu: "500m"
              memory: "512Mi"
            }
          }
          livenessProbe: {
            httpGet: {
              path: "/health"
              port: 8080
            }
            initialDelaySeconds: 30
            periodSeconds: 10
          }
          readinessProbe: {
            httpGet: {
              path: "/ready"
              port: 8080
            }
            initialDelaySeconds: 5
            periodSeconds: 5
          }
        }]
        imagePullSecrets: [{
          name: "registry-secret"
        }]
      }
    }
  }
}

service: {
  apiVersion: "v1"
  kind: "Service"
  metadata: {
    name: "web-app-service"
    namespace: "production"
    labels: {
      app: "web-app"
    }
  }
  spec: {
    selector: {
      app: "web-app"
      component: "backend"
    }
    ports: [{
      name: "http"
      port: 80
      targetPort: 8080
      protocol: "TCP"
    }]
    type: "ClusterIP"
  }
}

configMap: {
  apiVersion: "v1"
  kind: "ConfigMap"
  metadata: {
    name: "web-app-config"
    namespace: "production"
  }
  data: {
    "app.yaml": """
      server:
        port: 8080
        host: 0.0.0.0
      logging:
        level: info
        format: json
      """
  }
}`;

      await fs.writeFile(cueFile, cueContent);

      const outputFile = path.join(testDir, 'k8s-manifests.yaml');

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'k8s',
          '--output', outputFile
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
      }

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain('✓ Exported k8s');

      // Check output file exists and contains expected content
      const outputExists = await fs.pathExists(outputFile);
      expect(outputExists).toBe(true);

      if (outputExists) {
        const outputContent = await fs.readFile(outputFile, 'utf-8');
        expect(outputContent).toContain('apiVersion: apps/v1');
        expect(outputContent).toContain('kind: Deployment');
        expect(outputContent).toContain('name: web-app');
        expect(outputContent).toContain('namespace: production');
        expect(outputContent).toContain('replicas: 3');
        expect(outputContent).toContain('kind: Service');
        expect(outputContent).toContain('kind: ConfigMap');
      }
    });
  });

  describe('Multiple Format Export', () => {
    test('should export multiple formats from single file', async () => {
      const cueFile = path.join(testDir, 'multi.cue');
      const cueContent = `
// #OpenAPI api version=3.1.0
// #TypeScript models
// #K8s deployment
package multi

// API spec
api: {
  openapi: "3.1.0"
  info: {
    title: "Multi-format API"
    version: "1.0.0"
  }
  paths: {
    "/items": {
      get: {
        responses: {
          "200": {
            description: "Success"
          }
        }
      }
    }
  }
}

// Type definitions
#Item: {
  id: string
  name: string
  value: number
}

items: [...#Item]

// K8s resources
deployment: {
  apiVersion: "apps/v1"
  kind: "Deployment"
  metadata: name: "multi-app"
  spec: {
    replicas: 2
    selector: matchLabels: app: "multi-app"
    template: {
      metadata: labels: app: "multi-app"
      spec: containers: [{
        name: "app"
        image: "multi-app:latest"
        ports: [{containerPort: 3000}]
      }]
    }
  }
}`;

      await fs.writeFile(cueFile, cueContent);

      const outputDir = path.join(testDir, 'multi-output');

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'openapi,types,k8s',
          '--output', outputDir,
          '--verbose'
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        console.log('STDOUT:', stdout);
        console.log('STDERR:', stderr);
      }

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain('✓ Exported openapi');
      expect(stdout).toContain('✓ Exported types');
      expect(stdout).toContain('✓ Exported k8s');

      // Check that output directory contains all expected files
      const outputExists = await fs.pathExists(outputDir);
      expect(outputExists).toBe(true);

      if (outputExists) {
        const files = await fs.readdir(outputDir);
        expect(files.length).toBeGreaterThan(0);
        
        // Should have files for each format
        const hasOpenAPIFile = files.some(f => f.includes('openapi') || f.includes('api'));
        const hasTypesFile = files.some(f => f.includes('types') || f.endsWith('.d.ts'));
        const hasK8sFile = files.some(f => f.includes('k8s') || f.includes('yaml'));
        
        expect(hasOpenAPIFile || hasTypesFile || hasK8sFile).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle missing export tags gracefully', async () => {
      const cueFile = path.join(testDir, 'no-tags.cue');
      const cueContent = `
package test

data: {
  key: "value"
}`;

      await fs.writeFile(cueFile, cueContent);

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'openapi'
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      expect(proc.exitCode).not.toBe(0);
      expect(stderr || stdout).toContain('No #OPENAPI tags found');
    });

    test('should handle invalid CUE syntax', async () => {
      const cueFile = path.join(testDir, 'invalid.cue');
      const cueContent = `
// #OpenAPI test
package test
invalid syntax here {{{`;

      await fs.writeFile(cueFile, cueContent);

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'openapi'
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      expect(proc.exitCode).not.toBe(0);
      expect(stderr || stdout).toContain('failed');
    });

    test('should handle non-existent files', async () => {
      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          'non-existent-file.cue',
          '--format', 'openapi'
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      expect(proc.exitCode).not.toBe(0);
      expect(stderr || stdout).toContain('No valid input files found');
    });
  });

  describe('Output Options', () => {
    test('should output to stdout when no output file specified', async () => {
      const cueFile = path.join(testDir, 'stdout.cue');
      const cueContent = `
// #OpenAPI stdout-api
package test

openapi: "3.1.0"
info: { title: "Stdout API", version: "1.0.0" }
paths: {}`;

      await fs.writeFile(cueFile, cueContent);

      const proc = spawn({
        cmd: cliPath.split(' ').concat([
          'export',
          cueFile,
          '--format', 'openapi'
        ]),
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      await proc.exited;

      if (proc.exitCode !== 0) {
        console.log('STDERR:', stderr);
      }

      expect(proc.exitCode).toBe(0);
      expect(stdout).toContain('openapi: "3.1.0"');
      expect(stdout).toContain('Stdout API');
    });
  });
});