/**
 * Unit tests for database operations
 * Tests SQLite database schema and CRUD operations
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync } from 'fs';
import { DatabaseOperations } from './server-isolated';

describe('Database Operations', () => {
  let db: Database;
  let dbOps: DatabaseOperations;
  const testDbPath = './test-db.sqlite';

  beforeEach(() => {
    // Create fresh test database
    try {
      unlinkSync(testDbPath);
    } catch {
      // File doesn't exist, that's fine
    }
    
    db = new Database(testDbPath, { create: true });
    // Enable foreign key constraints
    db.exec('PRAGMA foreign_keys = ON;');
    dbOps = new DatabaseOperations(db);
    dbOps.initSchema();
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(testDbPath);
    } catch {
      // File cleanup failed, that's okay for tests
    }
  });

  describe('Schema initialization', () => {
    test('should create all required tables', () => {
      // Verify tables exist by querying sqlite_master
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as { name: string }[];

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('revs');
      expect(tableNames).toContain('y_updates');
    });

    test('should create projects table with correct schema', () => {
      const schema = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='projects'
      `).get() as { sql: string };

      expect(schema.sql).toContain('id TEXT PRIMARY KEY');
      expect(schema.sql).toContain('name TEXT NOT NULL');
      expect(schema.sql).toContain('created_at DATETIME');
      expect(schema.sql).toContain('updated_at DATETIME');
    });

    test('should create revs table with correct constraints', () => {
      const schema = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='revs'
      `).get() as { sql: string };

      expect(schema.sql).toContain('PRIMARY KEY (project_id, rev)');
      expect(schema.sql).toContain('FOREIGN KEY (project_id) REFERENCES projects(id)');
    });

    test('should create y_updates table with correct constraints', () => {
      const schema = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='y_updates'
      `).get() as { sql: string };

      expect(schema.sql).toContain('PRIMARY KEY (project_id, seq)');
      expect(schema.sql).toContain('FOREIGN KEY (project_id) REFERENCES projects(id)');
      expect(schema.sql).toContain('update_data BLOB NOT NULL');
    });
  });

  describe('Project CRUD operations', () => {
    test('should create a project', () => {
      const projectData = { name: 'Test Project' };
      const project = dbOps.createProject(projectData);

      expect(project).toMatchObject({
        name: 'Test Project',
      });
      expect(project.id).toBeTruthy();
      expect(project.createdAt).toBeTruthy();
      expect(project.updatedAt).toBeTruthy();

      // Verify it was inserted into database
      const dbProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id);
      expect(dbProject).toBeTruthy();
    });

    test('should generate unique IDs for projects', () => {
      const project1 = dbOps.createProject({ name: 'Project 1' });
      const project2 = dbOps.createProject({ name: 'Project 2' });

      expect(project1.id).not.toBe(project2.id);
      expect(project1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('should get all projects ordered by updated_at DESC', () => {
      // Create test projects
      const project1 = dbOps.createProject({ name: 'Project 1' });
      const project2 = dbOps.createProject({ name: 'Project 2' });

      const projects = dbOps.getProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project 2'); // Most recent first
      expect(projects[1].name).toBe('Project 1');
    });

    test('should get project by ID', () => {
      const created = dbOps.createProject({ name: 'Test Project' });
      const retrieved = dbOps.getProject(created.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.name).toBe('Test Project');
    });

    test('should return undefined for non-existent project', () => {
      const project = dbOps.getProject('non-existent-id');
      expect(project).toBeNull();
    });
  });

  describe('Revision operations', () => {
    let projectId: string;

    beforeEach(() => {
      const project = dbOps.createProject({ name: 'Test Project' });
      projectId = project.id;
    });

    test('should save revision with auto-incrementing rev number', () => {
      const revision1 = { text: 'first revision content' };
      const revision2 = { text: 'second revision content' };

      // Save revisions
      expect(() => dbOps.saveRevision(projectId, revision1)).not.toThrow();
      expect(() => dbOps.saveRevision(projectId, revision2)).not.toThrow();

      // Verify revisions in database
      const revisions = db.prepare(`
        SELECT * FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(projectId) as any[];

      expect(revisions).toHaveLength(2);
      expect(revisions[0].rev).toBe(1);
      expect(revisions[0].text).toBe('first revision content');
      expect(revisions[1].rev).toBe(2);
      expect(revisions[1].text).toBe('second revision content');
    });

    test('should update project updated_at when saving revision', async () => {
      const originalProject = dbOps.getProject(projectId);
      const originalUpdatedAt = originalProject.updated_at;

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      dbOps.saveRevision(projectId, { text: 'new content' });

      const updatedProject = dbOps.getProject(projectId);
      expect(updatedProject.updated_at).not.toBe(originalUpdatedAt);
    });

    test('should throw error when saving revision for non-existent project', () => {
      expect(() => {
        dbOps.saveRevision('non-existent-id', { text: 'content' });
      }).toThrow('Project not found');
    });

    test('should get latest revision', () => {
      dbOps.saveRevision(projectId, { text: 'first revision' });
      dbOps.saveRevision(projectId, { text: 'second revision' });
      dbOps.saveRevision(projectId, { text: 'latest revision' });

      const latest = dbOps.getLatestRevision(projectId);

      expect(latest).toBeTruthy();
      expect(latest!.text).toBe('latest revision');
    });

    test('should return undefined for project with no revisions', () => {
      const latest = dbOps.getLatestRevision(projectId);
      expect(latest).toBeNull();
    });

    test('should handle multiple projects with separate revision sequences', () => {
      const project2 = dbOps.createProject({ name: 'Project 2' });

      dbOps.saveRevision(projectId, { text: 'project1-rev1' });
      dbOps.saveRevision(project2.id, { text: 'project2-rev1' });
      dbOps.saveRevision(projectId, { text: 'project1-rev2' });

      const project1Revs = db.prepare(`
        SELECT * FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(projectId) as any[];
      
      const project2Revs = db.prepare(`
        SELECT * FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(project2.id) as any[];

      expect(project1Revs).toHaveLength(2);
      expect(project1Revs[0].rev).toBe(1);
      expect(project1Revs[1].rev).toBe(2);

      expect(project2Revs).toHaveLength(1);
      expect(project2Revs[0].rev).toBe(1);
    });
  });

  describe('Y.js update operations', () => {
    let projectId: string;

    beforeEach(() => {
      const project = dbOps.createProject({ name: 'Test Project' });
      projectId = project.id;
    });

    test('should save Y.js update with auto-incrementing seq', () => {
      const update1 = Buffer.from('fake-yjs-update-1', 'utf8');
      const update2 = Buffer.from('fake-yjs-update-2', 'utf8');

      expect(() => dbOps.saveYjsUpdate(projectId, update1)).not.toThrow();
      expect(() => dbOps.saveYjsUpdate(projectId, update2)).not.toThrow();

      // Verify updates in database
      const updates = db.prepare(`
        SELECT * FROM y_updates WHERE project_id = ? ORDER BY seq ASC
      `).all(projectId) as any[];

      expect(updates).toHaveLength(2);
      expect(updates[0].seq).toBe(1);
      expect(updates[1].seq).toBe(2);
      
      // Verify binary data is stored correctly
      expect(Buffer.from(updates[0].update_data).toString('utf8')).toBe('fake-yjs-update-1');
      expect(Buffer.from(updates[1].update_data).toString('utf8')).toBe('fake-yjs-update-2');
    });

    test('should handle large binary updates', () => {
      // Create a large binary buffer (1KB)
      const largeUpdate = Buffer.alloc(1024, 0xFF);
      
      expect(() => dbOps.saveYjsUpdate(projectId, largeUpdate)).not.toThrow();

      const updates = db.prepare(`
        SELECT * FROM y_updates WHERE project_id = ?
      `).all(projectId) as any[];

      expect(updates).toHaveLength(1);
      expect(updates[0].update_data).toHaveLength(1024);
    });

    test('should maintain separate sequences per project', () => {
      const project2 = dbOps.createProject({ name: 'Project 2' });

      const update1 = Buffer.from('project1-update1', 'utf8');
      const update2 = Buffer.from('project2-update1', 'utf8');
      const update3 = Buffer.from('project1-update2', 'utf8');

      dbOps.saveYjsUpdate(projectId, update1);
      dbOps.saveYjsUpdate(project2.id, update2);
      dbOps.saveYjsUpdate(projectId, update3);

      const project1Updates = db.prepare(`
        SELECT seq FROM y_updates WHERE project_id = ? ORDER BY seq ASC
      `).all(projectId) as { seq: number }[];

      const project2Updates = db.prepare(`
        SELECT seq FROM y_updates WHERE project_id = ? ORDER BY seq ASC
      `).all(project2.id) as { seq: number }[];

      expect(project1Updates.map(u => u.seq)).toEqual([1, 2]);
      expect(project2Updates.map(u => u.seq)).toEqual([1]);
    });
  });

  describe('Database constraints and integrity', () => {
    test('should enforce foreign key constraint for revisions', () => {
      expect(() => {
        db.prepare(`
          INSERT INTO revs (project_id, rev, text) 
          VALUES ('non-existent-project', 1, 'test')
        `).run();
      }).toThrow();
    });

    test('should enforce foreign key constraint for Y.js updates', () => {
      expect(() => {
        const update = Buffer.from('test-update', 'utf8');
        db.prepare(`
          INSERT INTO y_updates (project_id, seq, update_data) 
          VALUES ('non-existent-project', 1, ?)
        `).run(update);
      }).toThrow();
    });

    test('should enforce primary key constraint for projects', () => {
      const project = dbOps.createProject({ name: 'Test Project' });
      
      expect(() => {
        db.prepare(`
          INSERT INTO projects (id, name) VALUES (?, 'Duplicate')
        `).run(project.id);
      }).toThrow();
    });

    test('should enforce composite primary key for revisions', () => {
      const project = dbOps.createProject({ name: 'Test Project' });
      
      dbOps.saveRevision(project.id, { text: 'first' });
      
      // Try to insert same project_id + rev combination
      expect(() => {
        db.prepare(`
          INSERT INTO revs (project_id, rev, text) VALUES (?, 1, 'duplicate')
        `).run(project.id);
      }).toThrow();
    });

    test('should handle concurrent revision inserts correctly', () => {
      const project = dbOps.createProject({ name: 'Test Project' });
      
      // Simulate concurrent saves (they should get sequential rev numbers)
      dbOps.saveRevision(project.id, { text: 'concurrent 1' });
      dbOps.saveRevision(project.id, { text: 'concurrent 2' });
      dbOps.saveRevision(project.id, { text: 'concurrent 3' });

      const revisions = db.prepare(`
        SELECT rev FROM revs WHERE project_id = ? ORDER BY rev ASC
      `).all(project.id) as { rev: number }[];

      expect(revisions.map(r => r.rev)).toEqual([1, 2, 3]);
    });
  });

  describe('Append-only semantics', () => {
    test('should never modify existing revisions', () => {
      const project = dbOps.createProject({ name: 'Test Project' });
      
      dbOps.saveRevision(project.id, { text: 'original content' });
      
      const originalRev = db.prepare(`
        SELECT * FROM revs WHERE project_id = ? AND rev = 1
      `).get(project.id) as any;
      
      // Save another revision
      dbOps.saveRevision(project.id, { text: 'new content' });
      
      // Verify original revision is unchanged
      const unchangedRev = db.prepare(`
        SELECT * FROM revs WHERE project_id = ? AND rev = 1
      `).get(project.id) as any;
      
      expect(unchangedRev.text).toBe('original content');
      expect(unchangedRev.created_at).toBe(originalRev.created_at);
    });

    test('should never modify existing Y.js updates', () => {
      const project = dbOps.createProject({ name: 'Test Project' });
      const originalUpdate = Buffer.from('original-update', 'utf8');
      
      dbOps.saveYjsUpdate(project.id, originalUpdate);
      
      const original = db.prepare(`
        SELECT * FROM y_updates WHERE project_id = ? AND seq = 1
      `).get(project.id) as any;
      
      // Save another update
      const newUpdate = Buffer.from('new-update', 'utf8');
      dbOps.saveYjsUpdate(project.id, newUpdate);
      
      // Verify original update is unchanged
      const unchanged = db.prepare(`
        SELECT * FROM y_updates WHERE project_id = ? AND seq = 1
      `).get(project.id) as any;
      
      expect(Buffer.from(unchanged.update_data).toString('utf8')).toBe('original-update');
      expect(unchanged.created_at).toBe(original.created_at);
    });
  });
});