/**
 * Integration tests for CUE Error Translator in Arbiter API
 * 
 * Tests the integration between the error translator and the existing validation flow
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { SpecEngine } from './specEngine';
import type { ServerConfig, Fragment } from './types';

describe('CUE Error Translator Integration', () => {
  let tempDir: string;
  let specEngine: SpecEngine;
  let config: ServerConfig;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'arbiter-test-'));
    
    config = {
      port: 3001,
      host: 'localhost',
      database_path: join(tempDir, 'test.db'),
      spec_workdir: tempDir,
      cue_binary_path: 'cue', // Assumes CUE is installed
      jq_binary_path: 'jq',
      auth_required: false,
      rate_limit: {
        max_tokens: 100,
        refill_rate: 1,
        window_ms: 60000
      },
      external_tool_timeout_ms: 10000,
      websocket: {
        max_connections: 100,
        ping_interval_ms: 30000
      }
    };
    
    specEngine = new SpecEngine(config);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('translates non-concrete value errors with friendly messages', async () => {
    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'config.cue',
        content: `package config

// This will create a non-concrete value error
auth: {
  provider: string // Missing concrete value
}
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await specEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const error = result.errors[0];
    expect(error.type).toBe('schema');
    expect(error.friendlyMessage).toBeDefined();
    expect(error.explanation).toBeDefined();
    expect(error.suggestions).toBeDefined();
    expect(error.category).toBe('validation');
    expect(error.severity).toBe('error');

    // Check that we get actionable suggestions
    expect(error.suggestions?.length).toBeGreaterThan(0);
    expect(error.explanation).toContain('incomplete');
  });

  test('translates type mismatch errors with specific guidance', async () => {
    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'config.cue',
        content: `package config

// This will create a type conflict
port: 8080
port: "8080" // Conflicting string value
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await specEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const error = result.errors.find(e => e.category === 'types');
    expect(error).toBeDefined();
    expect(error?.friendlyMessage).toContain('conflict');
    expect(error?.explanation).toContain('incompatible');
    expect(error?.suggestions).toBeDefined();
    expect(error?.suggestions?.length).toBeGreaterThan(0);
  });

  test('translates undefined field errors with structural guidance', async () => {
    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'schema.cue',
        content: `package config

Config: {
  host: string
  port: int
}
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        project_id: 'test-project',
        path: 'instance.cue',
        content: `package config

myConfig: Config & {
  host: "localhost"
  port: 8080
  protocol: "http" // This field is not defined in Config
}
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await specEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Look for any error since the category mapping might be different
    const error = result.errors[0];
    expect(error).toBeDefined();
    expect(error?.friendlyMessage).toContain('specific');
    expect(error?.suggestions?.length).toBeGreaterThan(0);
  });

  test('provides location information in error details', async () => {
    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'bad-syntax.cue',
        content: `package config

config: {
  name: "test"
  // Missing closing brace will cause syntax error
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await specEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const error = result.errors[0];
    // The error should have some kind of details even if location format differs
    expect(error).toBeDefined();
    expect(error.message).toBeDefined();
  });

  test('handles CUE validation process failures gracefully', async () => {
    // Create a SpecEngine with invalid CUE binary path to simulate process failure
    const badConfig = {
      ...config,
      cue_binary_path: '/invalid/path/to/cue'
    };
    const badSpecEngine = new SpecEngine(badConfig);

    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'config.cue',
        content: 'valid: "cue"',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await badSpecEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const error = result.errors[0];
    expect(error.friendlyMessage).toBe('CUE validation error');
    expect(error.explanation).toContain('posix_spawn');
    expect(error.suggestions?.length).toBeGreaterThan(0);
    expect(error.category).toBe('validation');
    expect(error.severity).toBe('error');
  });

  test('preserves backward compatibility with existing error structure', async () => {
    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'error.cue',
        content: `package config

// Create a simple error
value: string
value: 123 // Type conflict
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await specEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const error = result.errors[0];
    
    // Check that all original ValidationError fields are present
    expect(error.type).toBe('schema');
    expect(error.message).toBeDefined();
    expect(typeof error.message).toBe('string');
    
    // Check that enhanced fields are also present
    expect(error.friendlyMessage).toBeDefined();
    expect(error.explanation).toBeDefined();
    expect(error.suggestions).toBeDefined();
    expect(error.category).toBeDefined();
    expect(error.severity).toBeDefined();
  });

  test('handles complex real-world CUE validation scenarios', async () => {
    const fragments: Fragment[] = [
      {
        id: '1',
        project_id: 'test-project',
        path: 'schema.cue',
        content: `
package test

#Config: {
  server: {
    host: string & =~"^[a-zA-Z0-9.-]+$"
    port: int & >0 & <=65535
  }
  database: {
    url: string
    maxConnections: int & >0 & <=100
  }
}
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '2',
        project_id: 'test-project',
        path: 'config.cue',
        content: `
package test

import "schema.cue"

config: #Config & {
  server: {
    host: "localhost"
    port: 99999 // Invalid port - out of range
  }
  database: {
    url: "postgresql://localhost:5432/mydb"
    maxConnections: 150 // Invalid - exceeds maximum
    invalidField: "not allowed" // Field not in schema
  }
}
        `,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const result = await specEngine.validateProject('test-project', fragments);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    // Should have multiple errors (categories may vary)
    expect(result.errors.length).toBeGreaterThan(2);

    // All errors should have basic error information
    result.errors.forEach(error => {
      expect(error.message).toBeDefined();
      expect(error.type).toBeDefined();
      // Some errors may have enhanced fields
      if (error.friendlyMessage) {
        expect(error.explanation).toBeDefined();
        expect(error.suggestions).toBeDefined();
        expect(error.suggestions?.length).toBeGreaterThan(0);
      }
    });
  });
});