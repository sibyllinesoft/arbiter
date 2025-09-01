/**
 * Simplified integration tests that don't require CUE CLI
 * Tests core functionality without external dependencies
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync } from 'fs';
import { 
  DatabaseOperations,
  checkRateLimit,
} from './server-isolated';
import {
  createProjectSchema,
  saveRevisionSchema,
  wsMessageSchema,
} from './test-types';

// Simplified integration test environment (no CUE analysis)
class SimpleIntegrationEnvironment {
  public db: Database;
  public dbOps: DatabaseOperations;
  public rateLimitMap: Map<string, { tokens: number; lastRefill: number }>;
  private testDbPath: string;

  constructor() {
    this.testDbPath = './test-integration-simple.sqlite';
    this.setupDatabase();
    this.rateLimitMap = new Map();
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

  // Simulate rate limit check
  checkRateLimit(clientId: string, rateLimit = 1) {
    return checkRateLimit(this.rateLimitMap, clientId, rateLimit);
  }
}

describe('Simple Integration Tests', () => {
  let env: SimpleIntegrationEnvironment;

  beforeEach(() => {
    env = new SimpleIntegrationEnvironment();
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('Project management workflow', () => {
    test('should handle complete project lifecycle without CUE analysis', () => {
      // 1. Create project
      const createResponse = env.createProjectWorkflow('Simple Test Project');
      expect(createResponse.status).toBe(201);
      expect(createResponse.body.name).toBe('Simple Test Project');
      
      const projectId = createResponse.body.id;

      // 2. Save initial revision
      const cueContent = `
name: "simple-test"
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
      expect(savedRevision).not.toBeNull();
      expect(savedRevision!.text).toContain('simple-test');

      // 4. Verify project exists and can be retrieved
      const retrievedProject = env.dbOps.getProject(projectId);
      expect(retrievedProject).not.toBeNull();
      expect(retrievedProject!.id).toBe(projectId);

      // 5. Create another revision
      const updatedContent = cueContent.replace('simple-test', 'updated-test');
      const updateResponse = env.saveRevisionWorkflow(projectId, updatedContent);
      expect(updateResponse.status).toBe(200);

      // 6. Verify latest revision is updated
      const latestRevision = env.dbOps.getLatestRevision(projectId);
      expect(latestRevision!.text).toContain('updated-test');
    });

    test('should handle multiple projects independently', () => {
      // Create multiple projects
      const project1 = env.createProjectWorkflow('Project One');
      const project2 = env.createProjectWorkflow('Project Two');
      const project3 = env.createProjectWorkflow('Project Three');

      expect(project1.status).toBe(201);
      expect(project2.status).toBe(201);
      expect(project3.status).toBe(201);

      // Save revisions to each
      env.saveRevisionWorkflow(project1.body.id, 'content: "project-1"');
      env.saveRevisionWorkflow(project2.body.id, 'content: "project-2"');
      env.saveRevisionWorkflow(project3.body.id, 'content: "project-3"');

      // Verify each project has its own content
      const rev1 = env.dbOps.getLatestRevision(project1.body.id);
      const rev2 = env.dbOps.getLatestRevision(project2.body.id);
      const rev3 = env.dbOps.getLatestRevision(project3.body.id);

      expect(rev1!.text).toContain('project-1');
      expect(rev2!.text).toContain('project-2');
      expect(rev3!.text).toContain('project-3');

      // Verify all projects exist in list
      const allProjects = env.dbOps.getProjects();
      expect(allProjects).toHaveLength(3);

      const projectNames = allProjects.map(p => p.name);
      expect(projectNames).toContain('Project One');
      expect(projectNames).toContain('Project Two');
      expect(projectNames).toContain('Project Three');
    });

    test('should handle project not found errors', () => {
      const nonExistentId = 'non-existent-project-id';

      // Try to save revision to non-existent project
      const saveResponse = env.saveRevisionWorkflow(nonExistentId, 'test: "content"');
      expect(saveResponse.status).toBe(404);
      expect(saveResponse.body.error).toBe('Project not found');

      // Try to get non-existent project
      const project = env.dbOps.getProject(nonExistentId);
      expect(project).toBeNull();

      // Try to get latest revision for non-existent project
      const revision = env.dbOps.getLatestRevision(nonExistentId);
      expect(revision).toBeNull();
    });
  });

  describe('Rate limiting integration', () => {
    test('should enforce rate limits per client', () => {
      const client1 = 'client-1';
      const client2 = 'client-2';
      const rateLimit = 2;

      // Both clients should get their initial tokens
      expect(env.checkRateLimit(client1, rateLimit)).toBe(true);
      expect(env.checkRateLimit(client2, rateLimit)).toBe(true);

      // Each should be able to use their second token
      expect(env.checkRateLimit(client1, rateLimit)).toBe(true);
      expect(env.checkRateLimit(client2, rateLimit)).toBe(true);

      // Both should now be exhausted
      expect(env.checkRateLimit(client1, rateLimit)).toBe(false);
      expect(env.checkRateLimit(client2, rateLimit)).toBe(false);
    });

    test('should maintain separate rate limit buckets', () => {
      // Client 1 exhausts their limit
      expect(env.checkRateLimit('client-1', 1)).toBe(true);
      expect(env.checkRateLimit('client-1', 1)).toBe(false);

      // Client 2 should still have their tokens
      expect(env.checkRateLimit('client-2', 1)).toBe(true);
      expect(env.checkRateLimit('client-2', 1)).toBe(false);

      // Client 3 should also have their tokens
      expect(env.checkRateLimit('client-3', 1)).toBe(true);
    });
  });

  describe('Database integrity', () => {
    test('should maintain referential integrity', () => {
      const project = env.createProjectWorkflow('Integrity Test Project');
      const projectId = project.body.id;

      // Save several revisions
      const revisions = [
        'revision: 1\ncontent: "first"',
        'revision: 2\ncontent: "second"',
        'revision: 3\ncontent: "third"',
      ];

      for (const content of revisions) {
        const response = env.saveRevisionWorkflow(projectId, content);
        expect(response.status).toBe(200);
      }

      // Verify all revisions exist
      const allRevisions = env.db.prepare(`
        SELECT rev, text FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(projectId) as { rev: number; text: string }[];

      expect(allRevisions).toHaveLength(3);
      expect(allRevisions[0].rev).toBe(1);
      expect(allRevisions[1].rev).toBe(2);
      expect(allRevisions[2].rev).toBe(3);

      // Verify latest revision is correct
      const latest = env.dbOps.getLatestRevision(projectId);
      expect(latest!.text).toContain('third');
    });

    test('should handle Y.js update persistence', () => {
      const project = env.createProjectWorkflow('YJS Test Project');
      const projectId = project.body.id;

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

    test('should enforce foreign key constraints', () => {
      // Try to insert revision for non-existent project
      expect(() => {
        env.db.prepare(`
          INSERT INTO revs (project_id, rev, text) 
          VALUES ('fake-project-id', 1, 'test content')
        `).run();
      }).toThrow();

      // Try to insert Y.js update for non-existent project
      expect(() => {
        const update = Buffer.from('test-update', 'utf8');
        env.db.prepare(`
          INSERT INTO y_updates (project_id, seq, update_data) 
          VALUES ('fake-project-id', 1, ?)
        `).run(update);
      }).toThrow();
    });
  });

  describe('Schema validation', () => {
    test('should validate all request schemas', () => {
      // Valid project creation
      const validProject = { name: 'Valid Project' };
      expect(() => createProjectSchema.parse(validProject)).not.toThrow();

      // Invalid project creation (empty name)
      const invalidProject = { name: '' };
      expect(() => createProjectSchema.parse(invalidProject)).toThrow();

      // Valid revision
      const validRevision = { text: 'valid content' };
      expect(() => saveRevisionSchema.parse(validRevision)).not.toThrow();

      // Invalid revision (wrong field name)
      const invalidRevision = { content: 'wrong field' };
      expect(() => saveRevisionSchema.parse(invalidRevision)).toThrow();
    });

    test('should validate WebSocket messages', () => {
      // Valid messages
      const validMessages = [
        { type: 'hello' },
        {
          type: 'join',
          projectId: 'project-123',
          user: { id: 'user-1', name: 'Alice', color: '#ff0000' },
        },
        { type: 'leave', projectId: 'project-123' },
        {
          type: 'cursor',
          projectId: 'project-123',
          position: { line: 5, column: 10 },
        },
        {
          type: 'sync',
          projectId: 'project-123',
          update: 'base64-update-data',
        },
        {
          type: 'analyze',
          projectId: 'project-123',
          requestId: 'req-123',
        },
      ];

      for (const message of validMessages) {
        expect(() => wsMessageSchema.parse(message)).not.toThrow();
      }

      // Invalid messages
      const invalidMessages = [
        { type: 'invalid-type' },
        { type: 'join' }, // missing required fields
        { type: 'cursor', projectId: 'test' }, // missing position
      ];

      for (const message of invalidMessages) {
        expect(() => wsMessageSchema.parse(message)).toThrow();
      }
    });
  });

  describe('Performance and scalability', () => {
    test('should handle many projects efficiently', () => {
      const projectCount = 50;
      const projectIds: string[] = [];

      // Create many projects
      for (let i = 0; i < projectCount; i++) {
        const response = env.createProjectWorkflow(`Performance Test Project ${i}`);
        expect(response.status).toBe(201);
        projectIds.push(response.body.id);
      }

      // Verify all exist
      const allProjects = env.dbOps.getProjects();
      expect(allProjects).toHaveLength(projectCount);

      // Add revision to each
      for (const projectId of projectIds) {
        const response = env.saveRevisionWorkflow(projectId, `content: "project-${projectId}"`);
        expect(response.status).toBe(200);
      }

      // Verify latest revisions
      for (const projectId of projectIds) {
        const latest = env.dbOps.getLatestRevision(projectId);
        expect(latest).not.toBeNull();
        expect(latest!.text).toContain(projectId);
      }
    });

    test('should handle many revisions per project', () => {
      const project = env.createProjectWorkflow('Many Revisions Project');
      const projectId = project.body.id;

      const revisionCount = 100;

      // Add many revisions
      for (let i = 1; i <= revisionCount; i++) {
        const content = `revision: ${i}\ncontent: "data for revision ${i}"`;
        const response = env.saveRevisionWorkflow(projectId, content);
        expect(response.status).toBe(200);
      }

      // Verify latest revision
      const latest = env.dbOps.getLatestRevision(projectId);
      expect(latest!.text).toContain(`revision: ${revisionCount}`);

      // Verify total count
      const totalRevisions = env.db.prepare(`
        SELECT COUNT(*) as count FROM revs WHERE project_id = ?
      `).get(projectId) as { count: number };

      expect(totalRevisions.count).toBe(revisionCount);
    });
  });
});