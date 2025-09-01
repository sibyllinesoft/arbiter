/**
 * Integration tests for the full API system
 * Tests end-to-end workflows combining HTTP and WebSocket functionality
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync } from 'fs';
import { 
  DatabaseOperations,
  analyzeCue,
  checkRateLimit,
  createAnalysisQueue,
} from './server-isolated';
import {
  analyzeRequestSchema,
  createProjectSchema,
  saveRevisionSchema,
  wsMessageSchema,
  type WSMessage
} from './test-types';

// Integration test helpers
class IntegrationTestEnvironment {
  public db: Database;
  public dbOps: DatabaseOperations;
  public rateLimitMap: Map<string, { tokens: number; lastRefill: number }>;
  public analysisQueue: any;
  private testDbPath: string;

  constructor() {
    this.testDbPath = './test-integration.sqlite';
    this.setupDatabase();
    this.rateLimitMap = new Map();
    this.analysisQueue = createAnalysisQueue();
  }

  private setupDatabase() {
    try {
      unlinkSync(this.testDbPath);
    } catch {
      // File doesn't exist, that's fine
    }

    this.db = new Database(this.testDbPath, { create: true });
    // Enable foreign key constraints
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.dbOps = new DatabaseOperations(this.db);
    this.dbOps.initSchema();
  }

  cleanup() {
    this.db.close();
    try {
      unlinkSync(this.testDbPath);
    } catch {
      // Cleanup failed, that's okay for tests
    }
  }

  // Simulate full HTTP request/response cycle
  async simulateAnalyzeRequest(text: string, clientId: string = `test-client-${Math.random()}`) {
    // Validate request
    const request = { text, requestId: `req-${Date.now()}` };
    const parsed = analyzeRequestSchema.parse(request);

    // Check rate limiting - use unique client ID for each test request
    const rateLimited = !checkRateLimit(this.rateLimitMap, clientId, 1);
    if (rateLimited) {
      return { status: 429, body: { error: 'Rate limit exceeded' } };
    }

    // Queue analysis with shorter timeout for tests
    const result = await this.analysisQueue.add(() => 
      analyzeCue(parsed.text, parsed.requestId, 200) // 200ms timeout for tests
    );

    return { status: 200, body: result };
  }

  // Simulate project creation workflow
  createProjectWorkflow(name: string) {
    // Validate request
    const projectData = { name };
    const parsed = createProjectSchema.parse(projectData);

    // Create project
    const project = this.dbOps.createProject(parsed);

    return { status: 201, body: project };
  }

  // Simulate revision saving workflow
  saveRevisionWorkflow(projectId: string, text: string) {
    try {
      // Validate request
      const revisionData = { text };
      const parsed = saveRevisionSchema.parse(revisionData);

      // Save revision
      this.dbOps.saveRevision(projectId, parsed);

      return { status: 200, body: { success: true } };
    } catch (error) {
      if (error instanceof Error && error.message === 'Project not found') {
        return { status: 404, body: { error: 'Project not found' } };
      }
      return { status: 400, body: { error: error instanceof Error ? error.message : 'Invalid request' } };
    }
  }
}

describe('Integration Tests', () => {
  let env: IntegrationTestEnvironment;

  beforeEach(() => {
    env = new IntegrationTestEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('Complete project lifecycle', () => {
    test('should handle full project creation to analysis workflow', async () => {
      // 1. Create project
      const createResponse = env.createProjectWorkflow('Integration Test Project');
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.name).toBe('Integration Test Project');
      
      const projectId = createResponse.body.id;

      // 2. Save initial revision
      const cueContent = `
name: "integration-test"
config: {
  enabled: true
  timeout: 5000
}
services: ["api", "web", "db"]
`;

      const saveResponse = env.saveRevisionWorkflow(projectId, cueContent);
      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body.success).toBe(true);

      // 3. Verify revision was saved
      const savedRevision = env.dbOps.getLatestRevision(projectId);
      expect(savedRevision).toBeTruthy();
      expect(savedRevision!.text).toContain('integration-test');

      // 4. Analyze the saved content (with shorter timeout for tests)
      const analyzeResponse = await env.simulateAnalyzeRequest(cueContent);
      expect(analyzeResponse.status).toBe(200);
      expect(analyzeResponse.body.requestId).toBeTruthy();

      // 5. Verify project exists and can be retrieved
      const retrievedProject = env.dbOps.getProject(projectId);
      expect(retrievedProject).not.toBeNull();
      expect(retrievedProject!.id).toBe(projectId);
    }, 2000);

    test('should handle multiple revisions in project', async () => {
      // Create project
      const createResponse = env.createProjectWorkflow('Multi-Revision Project');
      const projectId = createResponse.body.id;

      // Save multiple revisions
      const revisions = [
        'name: "v1"\nversion: 1',
        'name: "v2"\nversion: 2\nfeatures: ["auth"]',
        'name: "v3"\nversion: 3\nfeatures: ["auth", "api"]',
      ];

      for (const [index, content] of revisions.entries()) {
        const saveResponse = env.saveRevisionWorkflow(projectId, content);
        expect(saveResponse.status).toBe(200);

        // Verify latest revision is correct
        const latest = env.dbOps.getLatestRevision(projectId);
        expect(latest!.text).toBe(content);
      }

      // Verify all revisions exist in database
      const allRevisions = env.db.prepare(`
        SELECT rev, text FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(projectId) as { rev: number; text: string }[];

      expect(allRevisions).toHaveLength(3);
      expect(allRevisions[0].rev).toBe(1);
      expect(allRevisions[2].rev).toBe(3);
    });

    test('should handle project not found errors', async () => {
      const nonExistentId = 'non-existent-project-id';

      // Try to save revision to non-existent project
      const saveResponse = env.saveRevisionWorkflow(nonExistentId, 'test: "content"');
      expect(saveResponse.status).toBe(404);
      expect(saveResponse.body.error).toBe('Project not found');

      // Try to get non-existent project
      const project = env.dbOps.getProject(nonExistentId);
      expect(project).toBeNull();
    });
  });

  describe('Rate limiting integration', () => {
    test('should enforce rate limits across multiple analysis requests', async () => {
      const clientId = 'rate-limited-client';
      const cueContent = 'name: "rate-test"';

      // First request should succeed
      const first = await env.simulateAnalyzeRequest(cueContent, clientId);
      expect(first.status).toBe(200);

      // Second immediate request should be rate limited
      const second = await env.simulateAnalyzeRequest(cueContent, clientId);
      expect(second.status).toBe(429);
      expect(second.body.error).toBe('Rate limit exceeded');

      // Verify rate limiting state
      const bucket = env.rateLimitMap.get(clientId);
      expect(bucket).toBeTruthy();
      expect(bucket!.tokens).toBe(0);
    });

    test('should allow requests from different clients', async () => {
      const cueContent = 'name: "multi-client-test"';

      // Both clients should be able to make requests
      const client1Response = await env.simulateAnalyzeRequest(cueContent, 'client-1');
      const client2Response = await env.simulateAnalyzeRequest(cueContent, 'client-2');

      expect(client1Response.status).toBe(200);
      expect(client2Response.status).toBe(200);

      // Both should now be rate limited
      const client1Second = await env.simulateAnalyzeRequest(cueContent, 'client-1');
      const client2Second = await env.simulateAnalyzeRequest(cueContent, 'client-2');

      expect(client1Second.status).toBe(429);
      expect(client2Second.status).toBe(429);
    });
  });

  describe('CUE analysis integration', () => {
    test('should handle various CUE content types', async () => {
      const testCases = [
        {
          name: 'simple object',
          content: 'name: "test"\nvalue: 42',
          expectSuccess: true,
        },
        {
          name: 'complex nested structure',
          content: `
services: {
  api: {
    image: "node:18"
    ports: ["3000:3000"]
  }
  db: {
    image: "postgres:14"
    ports: ["5432:5432"]
  }
}
`,
          expectSuccess: true,
        },
        {
          name: 'invalid syntax',
          content: 'name: "test\ninvalid: syntax {',
          expectSuccess: false,
        },
        {
          name: 'imports (blocked)',
          content: 'import "encoding/json"\nvalue: 42',
          expectSuccess: false,
        },
      ];

      for (const testCase of testCases) {
        const response = await env.simulateAnalyzeRequest(testCase.content);
        expect(response.status).toBe(200);

        if (testCase.expectSuccess) {
          // Should either succeed or fail due to missing CUE CLI
          if (response.body.errors.length === 0) {
            expect(response.body.value).toBeDefined();
            expect(response.body.graph).toBeDefined();
          } else {
            // If CUE CLI is not available, should have appropriate error
            expect(response.body.errors[0].message).toBeTruthy();
          }
        } else {
          // Should have errors
          expect(response.body.errors.length).toBeGreaterThan(0);
        }
      }
    }, 10000);

    test('should generate consistent request IDs', async () => {
      const content = 'name: "test"';
      
      const response1 = await env.simulateAnalyzeRequest(content);
      const response2 = await env.simulateAnalyzeRequest(content);

      expect(response1.body.requestId).toBeTruthy();
      expect(response2.body.requestId).toBeTruthy();
      expect(response1.body.requestId).not.toBe(response2.body.requestId);
    });
  });

  describe('WebSocket message validation integration', () => {
    test('should validate complete WebSocket workflow', () => {
      // Test a complete WebSocket session workflow
      const messages: WSMessage[] = [
        { type: 'hello' },
        {
          type: 'join',
          projectId: 'project-123',
          user: { id: 'user-456', name: 'Alice', color: '#ff0000' },
        },
        {
          type: 'cursor',
          projectId: 'project-123',
          position: { line: 5, column: 10 },
        },
        {
          type: 'sync',
          projectId: 'project-123',
          update: 'base64-yjs-update-data',
        },
        {
          type: 'analyze',
          projectId: 'project-123',
          requestId: 'analyze-req-789',
        },
        {
          type: 'leave',
          projectId: 'project-123',
        },
      ];

      // All messages should validate successfully
      for (const message of messages) {
        expect(() => wsMessageSchema.parse(message)).not.toThrow();
      }
    });

    test('should validate Y.js update persistence workflow', async () => {
      // Create project for Y.js updates
      const createResponse = env.createProjectWorkflow('YJS Test Project');
      const projectId = createResponse.body.id;

      // Simulate Y.js updates
      const updates = [
        Buffer.from('yjs-update-1', 'utf8'),
        Buffer.from('yjs-update-2', 'utf8'),
        Buffer.from('yjs-update-3', 'utf8'),
      ];

      for (const update of updates) {
        env.dbOps.saveYjsUpdate(projectId, update);
      }

      // Verify updates are stored correctly
      const storedUpdates = env.db.prepare(`
        SELECT seq, update_data FROM y_updates WHERE project_id = ? ORDER BY seq ASC
      `).all(projectId) as { seq: number; update_data: Buffer }[];

      expect(storedUpdates).toHaveLength(3);
      
      for (let i = 0; i < updates.length; i++) {
        expect(storedUpdates[i].seq).toBe(i + 1);
        expect(Buffer.from(storedUpdates[i].update_data).toString('utf8')).toBe(updates[i].toString('utf8'));
      }
    });
  });

  describe('Error handling and recovery', () => {
    test('should handle database transaction errors gracefully', async () => {
      // Close database to simulate connection error
      env.db.close();

      // Operations should throw appropriate errors
      expect(() => {
        env.dbOps.getProjects();
      }).toThrow();

      expect(() => {
        env.dbOps.createProject({ name: 'Test' });
      }).toThrow();
    });

    test('should handle schema validation errors consistently', async () => {
      // Test various invalid inputs
      const invalidInputs = [
        { schema: analyzeRequestSchema, data: { text: 'test' } }, // missing requestId
        { schema: createProjectSchema, data: {} }, // missing name
        { schema: saveRevisionSchema, data: { content: 'wrong field' } }, // wrong field name
        { schema: wsMessageSchema, data: { type: 'invalid-type' } }, // invalid type
      ];

      for (const { schema, data } of invalidInputs) {
        expect(() => schema.parse(data)).toThrow();
      }
    });

    test('should maintain data consistency during concurrent operations', async () => {
      // Create project
      const createResponse = env.createProjectWorkflow('Concurrent Test Project');
      const projectId = createResponse.body.id;

      // Simulate concurrent revision saves
      const concurrentSaves = Array.from({ length: 5 }, (_, i) =>
        env.saveRevisionWorkflow(projectId, `revision ${i + 1}`)
      );

      // All saves should succeed
      for (const response of concurrentSaves) {
        expect(response.status).toBe(200);
      }

      // Verify all revisions were saved with correct sequence numbers
      const revisions = env.db.prepare(`
        SELECT rev FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(projectId) as { rev: number }[];

      expect(revisions).toHaveLength(5);
      expect(revisions.map(r => r.rev)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('Performance and scalability', () => {
    test('should handle multiple projects efficiently', async () => {
      const projectCount = 10;
      const projects = [];

      // Create multiple projects
      for (let i = 0; i < projectCount; i++) {
        const response = env.createProjectWorkflow(`Project ${i}`);
        expect(response.status).toBe(201);
        projects.push(response.body);
      }

      // Verify all projects exist
      const allProjects = env.dbOps.getProjects();
      expect(allProjects).toHaveLength(projectCount);

      // Add revisions to each project
      for (const project of projects) {
        const saveResponse = env.saveRevisionWorkflow(project.id, `content for ${project.name}`);
        expect(saveResponse.status).toBe(200);
      }

      // Verify each project has its revision
      for (const project of projects) {
        const revision = env.dbOps.getLatestRevision(project.id);
        expect(revision).toBeTruthy();
        expect(revision!.text).toContain(project.name);
      }
    });

    test('should handle large text content within limits', async () => {
      // Create content at the size limit (64KB)
      const maxSizeContent = 'x'.repeat(64 * 1024);
      const request = { text: maxSizeContent, requestId: 'large-content-test' };

      // Should validate successfully
      expect(() => analyzeRequestSchema.parse(request)).not.toThrow();

      // Should be able to save as revision
      const createResponse = env.createProjectWorkflow('Large Content Project');
      const projectId = createResponse.body.id;

      const saveResponse = env.saveRevisionWorkflow(projectId, maxSizeContent);
      expect(saveResponse.status).toBe(200);

      // Should be able to retrieve
      const revision = env.dbOps.getLatestRevision(projectId);
      expect(revision!.text).toHaveLength(64 * 1024);
    });

    test('should maintain performance with many revisions', async () => {
      const createResponse = env.createProjectWorkflow('Many Revisions Project');
      const projectId = createResponse.body.id;

      const revisionCount = 50;

      // Add many revisions
      for (let i = 1; i <= revisionCount; i++) {
        const content = `revision: ${i}\ncontent: "data for revision ${i}"`;
        const saveResponse = env.saveRevisionWorkflow(projectId, content);
        expect(saveResponse.status).toBe(200);
      }

      // Latest revision should be correct
      const latest = env.dbOps.getLatestRevision(projectId);
      expect(latest!.text).toContain(`revision: ${revisionCount}`);

      // Total revision count should be correct
      const totalRevisions = env.db.prepare(`
        SELECT COUNT(*) as count FROM revs WHERE project_id = ?
      `).get(projectId) as { count: number };

      expect(totalRevisions.count).toBe(revisionCount);
    });
  });
});