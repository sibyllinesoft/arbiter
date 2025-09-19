import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { SpecWorkbenchDB } from '../db';
import type { ServerConfig } from '../types';

const TEST_DIR = path.join(tmpdir(), `arbiter-revision-test-${Date.now()}`);
const TEST_DB_PATH = path.join(TEST_DIR, 'test.db');

describe('Revision System Database Tests', () => {
  let db: SpecWorkbenchDB;

  beforeAll(async () => {
    await fs.ensureDir(TEST_DIR);

    const config: ServerConfig = {
      port: 5053,
      host: 'localhost',
      database_path: TEST_DB_PATH,
      spec_workdir: TEST_DIR,
      cue_binary_path: 'cue',
      jq_binary_path: 'jq',
      auth_required: false,
      rate_limit: {
        max_tokens: 100,
        refill_rate: 10,
        window_ms: 60000,
      },
      external_tool_timeout_ms: 5000,
      websocket: {
        max_connections: 10,
        ping_interval_ms: 30000,
      },
    };

    db = new SpecWorkbenchDB(config);
  });

  afterAll(async () => {
    db.close();
    await fs.remove(TEST_DIR);
  });

  describe('Fragment Creation with Revisions', () => {
    it('should create fragment with initial revision', async () => {
      const projectId = 'test-project';
      const fragmentPath = 'test/fragment';
      const content = '# Test content v1';
      const author = 'test-user';
      const message = 'Initial version';

      // Create project first
      await db.createProject(projectId, 'Test Project');

      // Create fragment
      const fragment = await db.createFragment(
        'fragment-id-1',
        projectId,
        fragmentPath,
        content,
        author,
        message
      );

      expect(fragment).toBeDefined();
      expect(fragment.project_id).toBe(projectId);
      expect(fragment.path).toBe(fragmentPath);
      expect(fragment.content).toBe(content);
      expect(fragment.head_revision_id).toBeDefined();

      // Verify revision was created
      const revisions = await db.listFragmentRevisions(fragment.id);
      expect(revisions).toHaveLength(1);
      expect(revisions[0].revision_number).toBe(1);
      expect(revisions[0].content).toBe(content);
      expect(revisions[0].author).toBe(author);
      expect(revisions[0].message).toBe(message);
    });

    it('should create subsequent revisions when updating fragment', async () => {
      const projectId = 'test-project-2';
      const fragmentPath = 'test/update-fragment';
      const content1 = '# Test content v1';
      const content2 = '# Test content v2\nupdated: true';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 2');

      // Create initial fragment
      const fragment = await db.createFragment(
        'fragment-id-2',
        projectId,
        fragmentPath,
        content1,
        author,
        'Initial version'
      );

      // Update fragment to create second revision
      const updatedFragment = await db.updateFragment(
        projectId,
        fragmentPath,
        content2,
        author,
        'Second version'
      );

      expect(updatedFragment.content).toBe(content2);

      // Verify two revisions exist
      const revisions = await db.listFragmentRevisions(fragment.id);
      expect(revisions).toHaveLength(2);

      // Check revision order (newest first)
      expect(revisions[0].revision_number).toBe(2);
      expect(revisions[0].content).toBe(content2);
      expect(revisions[0].message).toBe('Second version');

      expect(revisions[1].revision_number).toBe(1);
      expect(revisions[1].content).toBe(content1);
      expect(revisions[1].message).toBe('Initial version');
    });

    it('should not create revision for identical content', async () => {
      const projectId = 'test-project-3';
      const fragmentPath = 'test/identical-content';
      const content = '# Same content';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 3');

      // Create initial fragment
      const fragment = await db.createFragment(
        'fragment-id-3',
        projectId,
        fragmentPath,
        content,
        author,
        'Initial version'
      );

      // "Update" with identical content
      const updatedFragment = await db.updateFragment(
        projectId,
        fragmentPath,
        content,
        author,
        'Same content again'
      );

      // Should return the same fragment
      expect(updatedFragment.id).toBe(fragment.id);
      expect(updatedFragment.content).toBe(content);

      // Should still have only one revision
      const revisions = await db.listFragmentRevisions(fragment.id);
      expect(revisions).toHaveLength(1);
    });
  });

  describe('Revision Retrieval', () => {
    it('should retrieve specific revision by number', async () => {
      const projectId = 'test-project-4';
      const fragmentPath = 'test/revision-retrieval';
      const content1 = '# Version 1';
      const content2 = '# Version 2';
      const content3 = '# Version 3';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 4');

      // Create fragment with multiple revisions
      const fragment = await db.createFragment(
        'fragment-id-4',
        projectId,
        fragmentPath,
        content1,
        author,
        'Version 1'
      );

      await db.updateFragment(projectId, fragmentPath, content2, author, 'Version 2');
      await db.updateFragment(projectId, fragmentPath, content3, author, 'Version 3');

      // Test retrieving specific revisions
      const rev1 = await db.getFragmentRevision(fragment.id, 1);
      const rev2 = await db.getFragmentRevision(fragment.id, 2);
      const rev3 = await db.getFragmentRevision(fragment.id, 3);

      expect(rev1?.content).toBe(content1);
      expect(rev1?.message).toBe('Version 1');

      expect(rev2?.content).toBe(content2);
      expect(rev2?.message).toBe('Version 2');

      expect(rev3?.content).toBe(content3);
      expect(rev3?.message).toBe('Version 3');

      // Test retrieving non-existent revision
      const nonExistent = await db.getFragmentRevision(fragment.id, 99);
      expect(nonExistent).toBeNull();
    });

    it('should retrieve latest revision', async () => {
      const projectId = 'test-project-5';
      const fragmentPath = 'test/latest-revision';
      const content1 = '# Version 1';
      const content2 = '# Version 2';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 5');

      // Create fragment
      const fragment = await db.createFragment(
        'fragment-id-5',
        projectId,
        fragmentPath,
        content1,
        author,
        'Version 1'
      );

      let latestRev = await db.getLatestFragmentRevision(fragment.id);
      expect(latestRev?.revision_number).toBe(1);
      expect(latestRev?.content).toBe(content1);

      // Update fragment
      await db.updateFragment(projectId, fragmentPath, content2, author, 'Version 2');

      latestRev = await db.getLatestFragmentRevision(fragment.id);
      expect(latestRev?.revision_number).toBe(2);
      expect(latestRev?.content).toBe(content2);
    });
  });

  describe('Content Hashing and Deduplication', () => {
    it('should generate consistent content hashes', async () => {
      const projectId = 'test-project-6';
      const fragmentPath = 'test/content-hashing';
      const content = '# Test content for hashing';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 6');

      // Create two fragments with same content
      const fragment1 = await db.createFragment(
        'fragment-id-6a',
        projectId,
        `${fragmentPath}1`,
        content,
        author,
        'Test 1'
      );

      const fragment2 = await db.createFragment(
        'fragment-id-6b',
        projectId,
        `${fragmentPath}2`,
        content,
        author,
        'Test 2'
      );

      // Get revisions and check hashes
      const rev1 = await db.getLatestFragmentRevision(fragment1.id);
      const rev2 = await db.getLatestFragmentRevision(fragment2.id);

      expect(rev1?.content_hash).toBe(rev2?.content_hash);
      expect(rev1?.content_hash).toBeDefined();
      expect(rev1?.content_hash.length).toBe(64); // SHA-256 hex length
    });

    it('should generate different hashes for different content', async () => {
      const projectId = 'test-project-7';
      const fragmentPath = 'test/different-hashes';
      const content1 = '# Content 1';
      const content2 = '# Content 2';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 7');

      // Create fragment and update with different content
      const fragment = await db.createFragment(
        'fragment-id-7',
        projectId,
        fragmentPath,
        content1,
        author,
        'Version 1'
      );

      await db.updateFragment(projectId, fragmentPath, content2, author, 'Version 2');

      // Get both revisions
      const rev1 = await db.getFragmentRevision(fragment.id, 1);
      const rev2 = await db.getFragmentRevision(fragment.id, 2);

      expect(rev1?.content_hash).not.toBe(rev2?.content_hash);
      expect(rev1?.content_hash).toBeDefined();
      expect(rev2?.content_hash).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent fragment updates', async () => {
      const projectId = 'test-project-8';

      // Create project
      await db.createProject(projectId, 'Test Project 8');

      // Try to update non-existent fragment
      await expect(
        db.updateFragment(projectId, 'non/existent', 'content', 'user', 'message')
      ).rejects.toThrow('Fragment not found');
    });

    it('should handle non-existent project', async () => {
      await expect(
        db.updateFragment('non-existent-project', 'fragment', 'content', 'user', 'message')
      ).rejects.toThrow('Fragment not found');
    });

    it('should handle duplicate fragment paths', async () => {
      const projectId = 'test-project-9';
      const fragmentPath = 'test/duplicate-path';
      const content = '# Test content';
      const author = 'test-user';

      // Create project
      await db.createProject(projectId, 'Test Project 9');

      // Create first fragment
      await db.createFragment('fragment-id-9a', projectId, fragmentPath, content, author, 'First');

      // Try to create another fragment with same path
      await expect(
        db.createFragment('fragment-id-9b', projectId, fragmentPath, content, author, 'Second')
      ).rejects.toThrow();
    });
  });

  describe('Database Health', () => {
    it('should perform health check successfully', async () => {
      const isHealthy = await db.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle transactions properly', async () => {
      const projectId = 'test-project-10';

      // Create project
      await db.createProject(projectId, 'Test Project 10');

      const result = db.transaction(() => {
        // This should work within transaction
        return 'transaction-result';
      });

      expect(result).toBe('transaction-result');
    });
  });
});
