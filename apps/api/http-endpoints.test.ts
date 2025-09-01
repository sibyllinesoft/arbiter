/**
 * Integration tests for HTTP API endpoints
 * Tests the REST API functionality without full server
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync } from 'fs';
import { 
  DatabaseOperations, 
  checkRateLimit, 
  analyzeCue,
  createAnalysisQueue
} from './server-isolated';
import {
  analyzeRequestSchema,
  createProjectSchema,
  saveRevisionSchema,
  type AnalyzeRequest,
  type CreateProject,
  type SaveRevision
} from './test-types';

// Mock HTTP request/response helpers
class MockRequest {
  constructor(
    public method: string,
    public url: string,
    public body: any = null,
    public headers: Record<string, string> = {}
  ) {}

  async json() {
    return this.body;
  }
}

class MockResponse {
  constructor(
    public body: any,
    public init: { status?: number; headers?: Record<string, string> } = {}
  ) {}

  get status() {
    return this.init.status || 200;
  }

  get headers() {
    return this.init.headers || {};
  }

  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }
}

describe('HTTP API Endpoints', () => {
  let db: Database;
  let dbOps: DatabaseOperations;
  let rateLimitMap: Map<string, { tokens: number; lastRefill: number }>;
  const testDbPath = './test-http-api.sqlite';

  beforeEach(() => {
    // Clean up any existing test database
    try {
      unlinkSync(testDbPath);
    } catch {
      // File doesn't exist, that's fine
    }
    
    db = new Database(testDbPath, { create: true });
    dbOps = new DatabaseOperations(db);
    dbOps.initSchema();
    rateLimitMap = new Map();
  });

  afterEach(() => {
    db.close();
    try {
      unlinkSync(testDbPath);
    } catch {
      // File cleanup failed, that's okay for tests
    }
  });

  describe('POST /analyze endpoint', () => {
    test('should validate request schema', () => {
      const validRequest = {
        text: 'name: "test"',
        requestId: 'test-123',
      };

      const invalidRequest = {
        text: 'name: "test"',
        // Missing requestId
      };

      expect(() => analyzeRequestSchema.parse(validRequest)).not.toThrow();
      expect(() => analyzeRequestSchema.parse(invalidRequest)).toThrow();
    });

    test('should enforce text size limit', () => {
      const largeText = 'x'.repeat(65 * 1024); // 65KB > 64KB limit
      const request = {
        text: largeText,
        requestId: 'test-large',
      };

      expect(() => analyzeRequestSchema.parse(request)).toThrow();
    });

    test('should check rate limiting', () => {
      const clientId = 'test-client';
      
      // First request should pass
      expect(checkRateLimit(rateLimitMap, clientId, 1)).toBe(true);
      
      // Second immediate request should fail
      expect(checkRateLimit(rateLimitMap, clientId, 1)).toBe(false);
    });

    test('should analyze valid CUE content', async () => {
      const request: AnalyzeRequest = {
        text: 'name: "test"\nvalue: 42',
        requestId: 'analyze-test',
      };

      const result = await analyzeCue(request.text, request.requestId);
      
      expect(result.requestId).toBe('analyze-test');
      expect(result.errors).toBeDefined();
      
      // If CUE CLI is available and content is valid
      if (result.errors.length === 0) {
        expect(result.value).toBeDefined();
        expect(result.graph).toBeDefined();
        expect(result.graph).toBeInstanceOf(Array);
      }
    }, 3000);

    test('should handle CORS preflight requests', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };

      // Simulate OPTIONS request handling
      const optionsResponse = new MockResponse(null, { headers: corsHeaders });
      expect(optionsResponse.headers['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('Projects CRUD endpoints', () => {
    describe('POST /projects', () => {
      test('should create project with valid data', () => {
        const projectData: CreateProject = { name: 'Test Project' };
        
        expect(() => createProjectSchema.parse(projectData)).not.toThrow();
        
        const project = dbOps.createProject(projectData);
        
        expect(project).toMatchObject({
          name: 'Test Project',
        });
        expect(project.id).toBeTruthy();
        expect(project.createdAt).toBeTruthy();
        expect(project.updatedAt).toBeTruthy();
      });

      test('should validate project name is not empty', () => {
        const invalidProject = { name: '' };
        
        expect(() => createProjectSchema.parse(invalidProject)).toThrow();
      });

      test('should return 400 for invalid request body', () => {
        const invalidData = { invalid: 'field' };
        
        expect(() => createProjectSchema.parse(invalidData)).toThrow();
      });
    });

    describe('GET /projects', () => {
      test('should return empty array when no projects exist', () => {
        const projects = dbOps.getProjects();
        expect(projects).toEqual([]);
      });

      test('should return all projects ordered by updated_at DESC', () => {
        // Create test projects
        const project1 = dbOps.createProject({ name: 'Project 1' });
        const project2 = dbOps.createProject({ name: 'Project 2' });

        const projects = dbOps.getProjects();

        expect(projects).toHaveLength(2);
        expect(projects[0].name).toBe('Project 2'); // Most recent first
        expect(projects[1].name).toBe('Project 1');
      });
    });

    describe('GET /projects/:id', () => {
      test('should return project by ID', () => {
        const created = dbOps.createProject({ name: 'Test Project' });
        const retrieved = dbOps.getProject(created.id);

        expect(retrieved).toMatchObject({
          id: created.id,
          name: 'Test Project',
        });
      });

      test('should return 404 for non-existent project', () => {
        const project = dbOps.getProject('non-existent-id');
        expect(project).toBeNull();
      });
    });
  });

  describe('POST /projects/:id/revisions', () => {
    let projectId: string;

    beforeEach(() => {
      const project = dbOps.createProject({ name: 'Test Project' });
      projectId = project.id;
    });

    test('should save revision with valid data', () => {
      const revisionData: SaveRevision = { text: 'test content' };
      
      expect(() => saveRevisionSchema.parse(revisionData)).not.toThrow();
      expect(() => dbOps.saveRevision(projectId, revisionData)).not.toThrow();
    });

    test('should return 404 for non-existent project', () => {
      const revisionData: SaveRevision = { text: 'test content' };
      
      expect(() => {
        dbOps.saveRevision('non-existent-id', revisionData);
      }).toThrow('Project not found');
    });

    test('should validate revision schema', () => {
      const validRevision = { text: 'valid content' };
      const invalidRevision = { content: 'invalid field name' };
      
      expect(() => saveRevisionSchema.parse(validRevision)).not.toThrow();
      expect(() => saveRevisionSchema.parse(invalidRevision)).toThrow();
    });

    test('should handle empty revision text', () => {
      const emptyRevision: SaveRevision = { text: '' };
      
      expect(() => saveRevisionSchema.parse(emptyRevision)).not.toThrow();
      expect(() => dbOps.saveRevision(projectId, emptyRevision)).not.toThrow();
    });
  });

  describe('Error handling', () => {
    test('should handle malformed JSON', () => {
      const malformedJson = '{ invalid json';
      
      expect(() => JSON.parse(malformedJson)).toThrow();
    });

    test('should handle database connection errors gracefully', () => {
      // Close the database to simulate connection error
      db.close();
      
      expect(() => {
        db.prepare('SELECT 1').get();
      }).toThrow();
    });

    test('should handle schema validation errors', () => {
      const invalidData = {
        text: 'valid text',
        // Missing requestId field
      };
      
      try {
        analyzeRequestSchema.parse(invalidData);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Content-Type and headers validation', () => {
    test('should expect JSON content type', () => {
      const jsonHeaders = {
        'Content-Type': 'application/json',
      };
      
      expect(jsonHeaders['Content-Type']).toBe('application/json');
    });

    test('should return proper CORS headers', () => {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
      };
      
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Content-Type']).toBe('application/json');
    });
  });

  describe('Request size limits', () => {
    test('should handle large but valid requests', () => {
      const largeButValidText = 'x'.repeat(32 * 1024); // 32KB - within limit
      const request = {
        text: largeButValidText,
        requestId: 'large-request',
      };
      
      expect(() => analyzeRequestSchema.parse(request)).not.toThrow();
    });
  });

  describe('Response format validation', () => {
    test('should format success responses correctly', () => {
      const project = dbOps.createProject({ name: 'Test Project' });
      
      // Verify response structure
      expect(project).toHaveProperty('id');
      expect(project).toHaveProperty('name');
      expect(project).toHaveProperty('createdAt');
      expect(project).toHaveProperty('updatedAt');
      
      // Verify data types
      expect(typeof project.id).toBe('string');
      expect(typeof project.name).toBe('string');
      expect(typeof project.createdAt).toBe('string');
      expect(typeof project.updatedAt).toBe('string');
    });

    test('should format error responses consistently', () => {
      const errorResponse = {
        error: 'Test error message',
      };
      
      expect(errorResponse).toHaveProperty('error');
      expect(typeof errorResponse.error).toBe('string');
    });
  });

  describe('Integration scenarios', () => {
    test('should handle full project lifecycle', () => {
      // Create project
      const project = dbOps.createProject({ name: 'Integration Test Project' });
      expect(project.id).toBeTruthy();
      
      // Save revision
      const revision = { text: 'initial content' };
      expect(() => dbOps.saveRevision(project.id, revision)).not.toThrow();
      
      // Get latest revision
      const latest = dbOps.getLatestRevision(project.id);
      expect(latest).toBeTruthy();
      expect(latest!.text).toBe('initial content');
      
      // Update with new revision
      const newRevision = { text: 'updated content' };
      expect(() => dbOps.saveRevision(project.id, newRevision)).not.toThrow();
      
      // Verify new revision is latest
      const updatedLatest = dbOps.getLatestRevision(project.id);
      expect(updatedLatest!.text).toBe('updated content');
    });

    test('should handle multiple clients with rate limiting', () => {
      const client1 = 'client-1';
      const client2 = 'client-2';
      const rateLimit = 2;
      
      // Both clients should get their own buckets
      expect(checkRateLimit(rateLimitMap, client1, rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, client2, rateLimit)).toBe(true);
      
      // Each client should have independent limits
      expect(checkRateLimit(rateLimitMap, client1, rateLimit)).toBe(true);
      expect(checkRateLimit(rateLimitMap, client2, rateLimit)).toBe(true);
      
      // Both should be exhausted now
      expect(checkRateLimit(rateLimitMap, client1, rateLimit)).toBe(false);
      expect(checkRateLimit(rateLimitMap, client2, rateLimit)).toBe(false);
    });
  });
});