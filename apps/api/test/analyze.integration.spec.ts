/**
 * CUE analyzer integration tests
 * Tests actual CUE CLI integration without mocks, comparing results with golden snapshots
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, type Subprocess } from 'bun';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeRequestSchema, analysisResultSchema } from '../../../packages/shared/src/contracts';
import type { AnalysisResult, CueError } from '../../../packages/shared/src/generated-types';

// Test configuration
const TEST_TIMEOUT = 10000;
const CUE_TIMEOUT = 2000;
const GOLDEN_DIR = join(__dirname, 'golden');

// Ensure golden directory exists
beforeAll(() => {
  if (!existsSync(GOLDEN_DIR)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
  }
});

describe('CUE Analyzer Integration Tests', () => {
  describe('Valid CUE Content', () => {
    test('analyzes simple object', async () => {
      const cueContent = `
hello: "world"
number: 42
flag: true
`;
      
      const result = await analyzeCueContent(cueContent);
      
      // Should have no errors
      expect(result.errors).toHaveLength(0);
      
      // Should have evaluated value
      expect(result.value).toEqual({
        hello: "world",
        number: 42,
        flag: true,
      });
      
      // Should generate graph nodes
      expect(result.graph).toBeDefined();
      expect(result.graph?.length).toBeGreaterThan(0);
      
      // Verify golden snapshot
      await verifyGoldenSnapshot('simple-object', result);
    });

    test('analyzes nested structures', async () => {
      const cueContent = `
person: {
  name: "Alice"
  age: 30
  address: {
    street: "123 Main St"
    city: "Anytown"
    coordinates: {
      lat: 40.7128
      lng: -74.0060
    }
  }
  hobbies: ["reading", "hiking", "coding"]
}
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();
      expect(result.graph).toBeDefined();
      
      // Verify structure in value
      const value = result.value as any;
      expect(value.person.name).toBe("Alice");
      expect(value.person.address.coordinates.lat).toBe(40.7128);
      expect(value.person.hobbies).toEqual(["reading", "hiking", "coding"]);
      
      await verifyGoldenSnapshot('nested-structures', result);
    });

    test('analyzes constraints and validation', async () => {
      const cueContent = `
#Config: {
  name: string & =~"^[a-zA-Z]+$"
  port: int & >0 & <65536
  enabled: bool
}

config: #Config & {
  name: "MyApp"
  port: 8080
  enabled: true
}
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();
      
      await verifyGoldenSnapshot('constraints-validation', result);
    });

    test('analyzes list comprehensions', async () => {
      const cueContent = `
numbers: [1, 2, 3, 4, 5]
squares: [ for x in numbers { x * x } ]
evens: [ for x in numbers if (x mod 2) == 0 { x } ]
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      
      const value = result.value as any;
      expect(value.squares).toEqual([1, 4, 9, 16, 25]);
      expect(value.evens).toEqual([2, 4]);
      
      await verifyGoldenSnapshot('list-comprehensions', result);
    });
  });

  describe('CUE Syntax Errors', () => {
    test('captures parse errors with location', async () => {
      const cueContent = `
hello: "world"
invalid syntax here
another: "field"
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('syntax');
      expect(result.errors[0].line).toBe(3);
      expect(result.errors[0].column).toBeGreaterThan(0);
      
      await verifyGoldenSnapshot('parse-error', result);
    });

    test('captures multiple syntax errors', async () => {
      const cueContent = `
valid: "field"
error1: broken syntax
another_valid: 42
error2: [unclosed array
final: "field"
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors.length).toBeGreaterThan(0);
      // Should have line numbers for each error
      result.errors.forEach(error => {
        expect(error.line).toBeGreaterThan(0);
        expect(error.message).toBeTruthy();
      });
      
      await verifyGoldenSnapshot('multiple-parse-errors', result);
    });

    test('captures constraint violations', async () => {
      const cueContent = `
#Config: {
  name: string & =~"^[a-zA-Z]+$"
  port: int & >0 & <65536
}

config: #Config & {
  name: "Invalid123"  // Contains numbers, violates regex
  port: 70000         // Exceeds upper bound
}
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors.length).toBeGreaterThan(0);
      
      await verifyGoldenSnapshot('constraint-violations', result);
    });

    test('captures type mismatches', async () => {
      const cueContent = `
person: {
  name: string
  age: int
}

invalid_person: person & {
  name: 123      // Type mismatch - should be string
  age: "thirty"  // Type mismatch - should be int
}
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors.length).toBeGreaterThan(0);
      
      await verifyGoldenSnapshot('type-mismatches', result);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty content', async () => {
      const result = await analyzeCueContent('');
      
      expect(result.errors).toHaveLength(0);
      expect(result.value).toEqual({});
      
      await verifyGoldenSnapshot('empty-content', result);
    });

    test('handles whitespace-only content', async () => {
      const result = await analyzeCueContent('   \n  \t  \n  ');
      
      expect(result.errors).toHaveLength(0);
      expect(result.value).toEqual({});
      
      await verifyGoldenSnapshot('whitespace-only', result);
    });

    test('handles very large numbers', async () => {
      const cueContent = `
small: 1
large: 9223372036854775807
float: 1.7976931348623157e+308
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();
      
      await verifyGoldenSnapshot('large-numbers', result);
    });

    test('handles unicode content', async () => {
      const cueContent = `
message: "Hello 世界 🌍"
emoji: "🚀"
unicode_key: "αβγ"
nested: {
  "🔑": "key with emoji"
  "中文": "Chinese text"
}
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      expect(result.value).toBeDefined();
      
      const value = result.value as any;
      expect(value.message).toBe("Hello 世界 🌍");
      expect(value.nested["🔑"]).toBe("key with emoji");
      
      await verifyGoldenSnapshot('unicode-content', result);
    });
  });

  describe('Performance and Limits', () => {
    test('respects timeout limits', async () => {
      // Create content that might take longer to analyze but stays within 64KB limit
      const cueContent = `
#LargeStruct: {
  ${Array(50).fill(0).map((_, i) => `field${i}: string & =~"^[a-z]{100}$"`).join('\n  ')}
}

data: #LargeStruct & {
  ${Array(50).fill(0).map((_, i) => `field${i}: "${'a'.repeat(100)}"`).join('\n  ')}
}
`;
      
      const startTime = Date.now();
      const result = await analyzeCueContent(cueContent);
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(CUE_TIMEOUT);
      
      // Should either succeed or timeout gracefully
      if (result.errors.length > 0) {
        // If there are errors, they should be meaningful
        result.errors.forEach(error => {
          expect(error.message).toBeTruthy();
        });
      }
    });

    test('handles content at size limits', async () => {
      // Create content close to 64KB limit
      const baseContent = 'field: "' + 'x'.repeat(1000) + '"\n';
      const largeContent = Array(60).fill(baseContent).join('');
      
      expect(largeContent.length).toBeLessThan(65536); // Within 64KB limit
      
      const result = await analyzeCueContent(largeContent);
      
      // Should handle large content gracefully
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  describe('Graph Generation', () => {
    test('generates correct graph for nested objects', async () => {
      const cueContent = `
app: {
  config: {
    database: {
      host: "localhost"
      port: 5432
    }
    server: {
      port: 8080
    }
  }
  metadata: {
    name: "MyApp"
    version: "1.0.0"
  }
}
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      expect(result.graph).toBeDefined();
      expect(result.graph!.length).toBeGreaterThan(0);
      
      // Should have hierarchical structure
      const rootNode = result.graph!.find(n => n.id === 'app');
      expect(rootNode).toBeDefined();
      expect(rootNode!.type).toBe('object');
      expect(rootNode!.children).toContain('app.config');
      expect(rootNode!.children).toContain('app.metadata');
      
      await verifyGoldenSnapshot('graph-nested-objects', result);
    });

    test('generates correct graph for arrays', async () => {
      const cueContent = `
items: ["apple", "banana", "cherry"]
numbers: [1, 2, 3, 4, 5]
mixed: [1, "two", true, null]
`;
      
      const result = await analyzeCueContent(cueContent);
      
      expect(result.errors).toHaveLength(0);
      expect(result.graph).toBeDefined();
      
      const itemsNode = result.graph!.find(n => n.id === 'items');
      expect(itemsNode).toBeDefined();
      expect(itemsNode!.type).toBe('array');
      
      await verifyGoldenSnapshot('graph-arrays', result);
    });
  });
});

/**
 * Analyze CUE content using the actual CUE CLI tool
 */
async function analyzeCueContent(content: string): Promise<AnalysisResult> {
  const requestId = `test-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  
  // Validate request
  const request = analyzeRequestSchema.parse({
    text: content,
    requestId: requestId,
  });
  
  const result: AnalysisResult = {
    requestId: requestId,
    errors: [],
    value: undefined,
    graph: undefined,
  };
  
  try {
    // Create temporary file for CUE content
    const tempDir = tmpdir();
    const tempFile = join(tempDir, `cue-test-${Date.now()}.cue`);
    writeFileSync(tempFile, content);
    
    // Run CUE evaluation
    const evalProc = spawn(['cue', 'eval', '--out', 'json', tempFile], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    const evalResult = await evalProc.exited;
    const stdout = await new Response(evalProc.stdout).text();
    const stderr = await new Response(evalProc.stderr).text();
    
    if (evalResult === 0 && stdout.trim()) {
      try {
        result.value = JSON.parse(stdout);
      } catch (parseError) {
        result.errors.push({
          message: `Failed to parse CUE output: ${parseError}`,
        });
      }
    }
    
    // Parse stderr for errors
    if (stderr.trim()) {
      result.errors.push(...parseCueErrors(stderr));
    }
    
    // Generate graph if successful
    if (result.errors.length === 0 && result.value) {
      result.graph = generateGraph(result.value);
    }
    
    // Clean up temp file
    try {
      await Bun.file(tempFile).text(); // Test if file exists
      await spawn(['rm', tempFile]);
    } catch {
      // Ignore cleanup errors
    }
    
  } catch (error) {
    result.errors.push({
      message: `Analysis failed: ${error}`,
    });
  }
  
  // Validate result before returning
  return analysisResultSchema.parse(result);
}

/**
 * Parse CUE CLI error output into structured errors
 */
function parseCueErrors(stderr: string): CueError[] {
  const errors: CueError[] = [];
  const lines = stderr.split('\n').filter(line => line.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse format: "file.cue:line:col: error message"
    const match = line.match(/^([^:]+):(\d+):(\d+):\s*(.+)$/);
    if (match) {
      const [, filename, lineStr, colStr, message] = match;
      errors.push({
        message: message.trim(),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        filename: filename,
      });
    } else if (line.includes(':') && i + 1 < lines.length) {
      // Check if next line has location info: "    filename:line:col"
      const nextLine = lines[i + 1];
      const locationMatch = nextLine.match(/^\s*([^:]+):(\d+):(\d+)\s*$/);
      if (locationMatch) {
        const [, filename, lineStr, colStr] = locationMatch;
        errors.push({
          message: line.trim(),
          line: parseInt(lineStr, 10),
          column: parseInt(colStr, 10),
          filename: filename,
        });
        i++; // Skip the location line since we processed it
      } else if (line.includes('error') || line.includes('Error') || line.includes('syntax')) {
        // Fallback for unstructured errors
        errors.push({
          message: line.trim(),
        });
      }
    } else if (line.includes('error') || line.includes('Error') || line.includes('syntax')) {
      // Fallback for unstructured errors
      errors.push({
        message: line.trim(),
      });
    }
  }
  
  return errors;
}

/**
 * Generate graph representation from CUE value
 */
function generateGraph(value: unknown, parentId: string = '', path: string = ''): any[] {
  const nodes: any[] = [];
  
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      const nodeId = path || 'root';
      nodes.push({
        id: nodeId,
        label: path.split('.').pop() || 'root',
        type: 'array',
        children: value.map((_, i) => `${nodeId}[${i}]`),
      });
      
      value.forEach((item, index) => {
        const childPath = `${nodeId}[${index}]`;
        nodes.push(...generateGraph(item, nodeId, childPath));
      });
    } else {
      const nodeId = path || 'root';
      const children = Object.keys(value);
      
      nodes.push({
        id: nodeId,
        label: path.split('.').pop() || 'root',
        type: 'object',
        children: children.map(key => `${nodeId}.${key}`),
      });
      
      for (const [key, childValue] of Object.entries(value)) {
        const childPath = path ? `${path}.${key}` : key;
        nodes.push(...generateGraph(childValue, nodeId, childPath));
      }
    }
  } else {
    // Leaf node (primitive value)
    const nodeId = path || 'root';
    nodes.push({
      id: nodeId,
      label: `${path.split('.').pop() || 'root'}: ${JSON.stringify(value)}`,
      type: 'value',
    });
  }
  
  return nodes;
}

/**
 * Verify analysis result against golden snapshot
 */
async function verifyGoldenSnapshot(name: string, result: AnalysisResult): Promise<void> {
  const goldenFile = join(GOLDEN_DIR, `${name}.json`);
  const normalizedResult = normalizeAnalysisResult(result);
  
  if (process.env.UPDATE_GOLDEN === '1') {
    // Update golden file
    writeFileSync(goldenFile, JSON.stringify(normalizedResult, null, 2));
    console.log(`Updated golden file: ${goldenFile}`);
    return;
  }
  
  if (!existsSync(goldenFile)) {
    // Create golden file for first time
    writeFileSync(goldenFile, JSON.stringify(normalizedResult, null, 2));
    console.log(`Created golden file: ${goldenFile}`);
    return;
  }
  
  // Compare with existing golden file
  const goldenContent = JSON.parse(readFileSync(goldenFile, 'utf8'));
  expect(normalizedResult).toEqual(goldenContent);
}

/**
 * Normalize analysis result for consistent golden snapshots
 */
function normalizeAnalysisResult(result: AnalysisResult): any {
  return {
    errors: result.errors.map(error => ({
      message: error.message?.replace(/\/tmp\/cue-test-\d+\.cue/g, 'test-file.cue') || error.message,
      line: error.line,
      column: error.column,
      // Remove filename for consistency (temp files have random names)
    })).sort((a, b) => (a.line || 0) - (b.line || 0)),
    hasValue: result.value !== undefined,
    value: result.value,
    hasGraph: result.graph !== undefined,
    graphNodeCount: result.graph?.length || 0,
    graph: result.graph?.sort((a, b) => a.id.localeCompare(b.id)),
  };
}