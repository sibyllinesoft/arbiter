/**
 * Isolated server components for testing
 * This file extracts the core logic from server.ts to make it testable
 * without the full server running or external module dependencies
 */

import type { Database } from 'bun:sqlite';
import { spawn } from 'bun';
import { randomUUID } from 'crypto';
import { mkdtemp, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
// Simple queue implementation to replace p-queue dependency
class SimpleQueue {
  private tasks: (() => Promise<any>)[] = [];
  private running = 0;
  private concurrency: number;
  
  constructor(options: { concurrency: number }) {
    this.concurrency = options.concurrency;
  }
  
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.tasks.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }
  
  private async process() {
    if (this.running >= this.concurrency || this.tasks.length === 0) return;
    
    const task = this.tasks.shift();
    if (!task) return;
    
    this.running++;
    try {
      await task();
    } finally {
      this.running--;
      this.process();
    }
  }
}
import type { 
  AnalyzeRequest, 
  AnalysisResultSchema, 
  CreateProject,
  ProjectResponse,
  SaveRevision 
} from './test-types';

// Configuration that matches server.ts
export const CONFIG = {
  maxConcurrency: 4,
  timeout: 750, // ms
  maxTextSize: 64 * 1024, // 64KB
  maxMemory: 128 * 1024 * 1024, // 128MB
  rateLimit: 1, // requests per second per client
};

// Interfaces
export interface CueError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
  severity?: 'error' | 'warning' | 'info';
  violationId?: string;
  friendlyMessage?: string;
  suggestedFix?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
  violations?: {
    severity: 'error' | 'warning' | 'info';
    violationIds: string[];
    count: number;
  };
}

/**
 * Parse CUE stderr output to extract error information
 */
export function parseCueStderr(stderr: string): CueError[] {
  const errors: CueError[] = [];
  const lines = stderr.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Match CUE error format: "filename:line:column: message"
    const match = line.match(/^([^:]*):(\d+):(\d+):\s*(.+)$/);
    if (match) {
      const message = match[4];
      const error: CueError = {
        filename: match[1] || undefined,
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        message,
        violationId: generateViolationId(message, parseInt(match[2])),
        severity: classifyErrorSeverity(message),
        friendlyMessage: generateFriendlyMessage(message),
        suggestedFix: generateSuggestedFix(message),
      };
      errors.push(error);
    } else {
      // Generic error without position info
      const error: CueError = {
        message: line,
        violationId: generateViolationId(line),
        severity: classifyErrorSeverity(line),
        friendlyMessage: generateFriendlyMessage(line),
        suggestedFix: generateSuggestedFix(line),
      };
      errors.push(error);
    }
  }
  
  return errors;
}

/**
 * Generate a unique violation ID for tracking
 */
function generateViolationId(message: string, line?: number): string {
  const hash = message.replace(/\s+/g, '_').toLowerCase().substring(0, 20);
  return `violation_${hash}_${line || 0}_${Date.now() % 10000}`;
}

/**
 * Classify error severity based on message patterns
 */
function classifyErrorSeverity(message: string): 'error' | 'warning' | 'info' {
  const lowerMessage = message.toLowerCase();
  
  // Errors (blocking issues)
  if (lowerMessage.includes('conflicting values') ||
      lowerMessage.includes('undefined field') ||
      lowerMessage.includes('cannot unify') ||
      lowerMessage.includes('syntax error') ||
      lowerMessage.includes('invalid') ||
      lowerMessage.includes('not allowed')) {
    return 'error';
  }
  
  // Warnings (non-blocking but important)
  if (lowerMessage.includes('incomplete') ||
      lowerMessage.includes('may') ||
      lowerMessage.includes('should') ||
      lowerMessage.includes('deprecated')) {
    return 'warning';
  }
  
  // Default to error for safety
  return 'error';
}

/**
 * Generate user-friendly error messages
 */
function generateFriendlyMessage(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('conflicting values')) {
    return 'You have defined the same field with different values. CUE requires all values for a field to be consistent.';
  }
  
  if (lowerMessage.includes('undefined field')) {
    return 'This field is not allowed in the current schema. Check your schema definition or remove the extra field.';
  }
  
  if (lowerMessage.includes('cannot unify')) {
    return 'The values you provided cannot be combined. This usually means type mismatch or constraint violation.';
  }
  
  if (lowerMessage.includes('incomplete')) {
    return 'Some values are not fully specified. CUE needs concrete values to export your configuration.';
  }
  
  if (lowerMessage.includes('syntax error')) {
    return 'There is a syntax error in your CUE code. Please check brackets, commas, and other syntax elements.';
  }
  
  // Default friendly message
  return 'There is an issue with your CUE configuration. Please review the specific error details.';
}

/**
 * Generate suggested fixes for common errors
 */
function generateSuggestedFix(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('conflicting values')) {
    return 'Remove one of the conflicting definitions or use a disjunction (|) to allow multiple values.';
  }
  
  if (lowerMessage.includes('undefined field')) {
    return 'Either remove the undefined field or add it to your schema definition.';
  }
  
  if (lowerMessage.includes('cannot unify')) {
    return 'Check that all values have compatible types and satisfy the constraints.';
  }
  
  if (lowerMessage.includes('incomplete')) {
    return 'Provide concrete values for all required fields, or use default values in your schema.';
  }
  
  if (lowerMessage.includes('syntax error')) {
    return 'Check for missing commas, unclosed brackets, or other syntax issues.';
  }
  
  return 'Review the error message and check the CUE documentation for specific guidance.';
}

/**
 * Build a simple graph from CUE value (top-level keys → nodes)
 */
export function buildGraph(value: any, errors: CueError[] = []): GraphNode[] {
  const nodes: GraphNode[] = [];
  
  if (typeof value !== 'object' || value === null) {
    return nodes;
  }
  
  // Cap graph size for performance
  const keys = Object.keys(value);
  if (keys.length > 200) {
    nodes.push({
      id: 'summary',
      label: `Large object (${keys.length} keys)`,
      type: 'object',
    });
    return nodes;
  }
  
  // Create a map of violations by field path for quick lookup
  const violationMap = createViolationMap(errors);
  
  for (const key of keys) {
    const val = value[key];
    let type: 'object' | 'array' | 'value' = 'value';
    
    if (Array.isArray(val)) {
      type = 'array';
    } else if (typeof val === 'object' && val !== null) {
      type = 'object';
    }
    
    // Check for violations related to this node
    const nodeViolations = getNodeViolations(key, violationMap);
    
    nodes.push({
      id: key,
      label: key,
      type,
      children: type === 'object' ? Object.keys(val).slice(0, 10) : undefined,
      violations: nodeViolations.length > 0 ? {
        severity: getHighestSeverity(nodeViolations),
        violationIds: nodeViolations.map(v => v.violationId!),
        count: nodeViolations.length
      } : undefined,
    });
  }
  
  return nodes;
}

/**
 * Create a map of violations organized by potential field paths
 */
function createViolationMap(errors: CueError[]): Map<string, CueError[]> {
  const violationMap = new Map<string, CueError[]>();
  
  for (const error of errors) {
    // Extract potential field names from error messages
    const fieldNames = extractFieldNames(error.message);
    
    for (const fieldName of fieldNames) {
      if (!violationMap.has(fieldName)) {
        violationMap.set(fieldName, []);
      }
      violationMap.get(fieldName)!.push(error);
    }
    
    // Also map by line number if available
    if (error.line) {
      const lineKey = `line_${error.line}`;
      if (!violationMap.has(lineKey)) {
        violationMap.set(lineKey, []);
      }
      violationMap.get(lineKey)!.push(error);
    }
  }
  
  return violationMap;
}

/**
 * Extract field names from error messages
 */
function extractFieldNames(message: string): string[] {
  const fieldNames: string[] = [];
  
  // Look for field references in various formats
  const patterns = [
    /field "([^"]+)"/g,
    /field '([^']+)'/g,
    /field `([^`]+)`/g,
    /field ([a-zA-Z_][a-zA-Z0-9_]*)/g,
    /\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      fieldNames.push(match[1]);
    }
  }
  
  return [...new Set(fieldNames)]; // Remove duplicates
}

/**
 * Get violations for a specific node
 */
function getNodeViolations(nodeId: string, violationMap: Map<string, CueError[]>): CueError[] {
  const violations: CueError[] = [];
  
  // Direct field name match
  const directMatch = violationMap.get(nodeId);
  if (directMatch) {
    violations.push(...directMatch);
  }
  
  // Look for violations that might reference this field
  for (const [key, errors] of violationMap.entries()) {
    if (key !== nodeId && (key.includes(nodeId) || errors.some(e => e.message.includes(nodeId)))) {
      violations.push(...errors);
    }
  }
  
  return [...new Set(violations)]; // Remove duplicates
}

/**
 * Get the highest severity from a list of violations
 */
function getHighestSeverity(violations: CueError[]): 'error' | 'warning' | 'info' {
  const severities = violations.map(v => v.severity || 'error');
  
  if (severities.includes('error')) return 'error';
  if (severities.includes('warning')) return 'warning';
  return 'info';
}

/**
 * Build a basic graph structure from CUE text analysis when JSON parsing fails
 * This enables violation visualization even when CUE has errors
 */
function buildGraphFromText(text: string, errors: CueError[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  const violationMap = createViolationMap(errors);
  
  // Extract top-level field definitions from CUE text
  const fieldPattern = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/gm;
  const fieldMatches = [...text.matchAll(fieldPattern)];
  
  for (const match of fieldMatches) {
    const fieldName = match[1];
    
    // Determine the type based on the value pattern
    const valuePattern = new RegExp(`${fieldName}\\s*:\\s*(.+)`);
    const valueMatch = text.match(valuePattern);
    let type: 'object' | 'array' | 'value' = 'value';
    
    if (valueMatch) {
      const value = valueMatch[1].trim();
      if (value.startsWith('{')) {
        type = 'object';
      } else if (value.startsWith('[')) {
        type = 'array';
      }
    }
    
    // Check for violations related to this field
    const nodeViolations = getNodeViolations(fieldName, violationMap);
    
    nodes.push({
      id: fieldName,
      label: fieldName,
      type,
      violations: nodeViolations.length > 0 ? {
        severity: getHighestSeverity(nodeViolations),
        violationIds: nodeViolations.map(v => v.violationId!),
        count: nodeViolations.length
      } : undefined,
    });
  }
  
  // If no fields found, create a summary node with all violations
  if (nodes.length === 0 && errors.length > 0) {
    nodes.push({
      id: 'document',
      label: 'CUE Document',
      type: 'object',
      violations: {
        severity: getHighestSeverity(errors),
        violationIds: errors.map(e => e.violationId!).filter(Boolean),
        count: errors.length
      }
    });
  }
  
  return nodes;
}

/**
 * Analyze CUE text using the cue CLI
 */
export async function analyzeCue(text: string, requestId: string, timeout = CONFIG.timeout): Promise<AnalysisResultSchema> {
  try {
    // Create temporary directory
    const tempDir = await mkdtemp(join(tmpdir(), 'cue-analysis-'));
    const docPath = join(tempDir, 'doc.cue');
    
    // Write CUE content (security: only write doc.cue, no imports allowed in v0)
    if (text.includes('import')) {
      return {
        requestId,
        errors: [{ message: 'Imports are not allowed in this version' }],
      };
    }
    
    await writeFile(docPath, text, 'utf8');
    
    // Spawn CUE process with timeout
    const proc = spawn({
      cmd: ['cue', 'export', 'doc.cue'],
      cwd: tempDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    
    // Race against timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout')), timeout);
    });
    
    try {
      await Promise.race([proc.exited, timeoutPromise]);
      
      if (proc.exitCode === 0) {
        // Success - parse output
        const stdout = await new Response(proc.stdout).text();
        const value = JSON.parse(stdout);
        const graph = buildGraph(value, []); // No errors in success case
        
        return {
          requestId,
          errors: [],
          value,
          graph,
        };
      } else {
        // Error - parse stderr and attempt to get partial value for visualization
        const stderr = await new Response(proc.stderr).text();
        const errors = parseCueStderr(stderr);
        
        // Try to get a partial graph even when there are errors
        // This helps with violation visualization
        let graph: any[] = [];
        try {
          // Try to parse with CUE eval instead of export to get partial results
          const evalProc = spawn({
            cmd: ['cue', 'eval', 'doc.cue', '--out', 'json'],
            cwd: tempDir,
            stdout: 'pipe',
            stderr: 'pipe',
          });
          
          await Promise.race([evalProc.exited, timeoutPromise]);
          
          if (evalProc.exitCode === 0) {
            const evalStdout = await new Response(evalProc.stdout).text();
            const partialValue = JSON.parse(evalStdout);
            graph = buildGraph(partialValue, errors);
          } else {
            // If eval also fails, create a basic graph structure from text analysis
            graph = buildGraphFromText(text, errors);
          }
        } catch {
          // Fallback to text-based graph creation
          graph = buildGraphFromText(text, errors);
        }
        
        return {
          requestId,
          errors,
          graph,
        };
      }
    } catch (error) {
      proc.kill();
      if (error instanceof Error && error.message === 'Analysis timeout') {
        return {
          requestId,
          errors: [{ message: `Analysis timed out (${timeout}ms limit exceeded)` }],
        };
      }
      throw error;
    }
  } catch (error) {
    return {
      requestId,
      errors: [{ 
        message: error instanceof Error ? error.message : 'Unknown analysis error' 
      }],
    };
  }
}

/**
 * Check rate limit for client
 */
export function checkRateLimit(
  rateLimitMap: Map<string, { tokens: number; lastRefill: number }>,
  clientId: string,
  rateLimit = CONFIG.rateLimit
): boolean {
  const now = Date.now();
  let bucket = rateLimitMap.get(clientId);
  
  if (!bucket) {
    bucket = { tokens: rateLimit, lastRefill: now };
    rateLimitMap.set(clientId, bucket);
  }
  
  // Refill tokens (1 token per second)
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / 1000);
  
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(rateLimit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
  
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }
  
  return false;
}

/**
 * Database operations
 */
export class DatabaseOperations {
  constructor(private db: Database) {}

  createProject(project: CreateProject): ProjectResponse {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)');
    stmt.run(id, project.name, now, now);
    
    return {
      id,
      name: project.name,
      createdAt: now,
      updatedAt: now,
    };
  }

  getProjects(): any[] {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
    return stmt.all();
  }

  getProject(id: string): any | undefined {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id);
  }

  saveRevision(projectId: string, revision: SaveRevision): void {
    // Check if project exists
    const projectStmt = this.db.prepare('SELECT id FROM projects WHERE id = ?');
    const project = projectStmt.get(projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Insert new revision
    const revStmt = this.db.prepare(`
      INSERT INTO revs (project_id, rev, text, created_at)
      SELECT ?, COALESCE(MAX(rev), 0) + 1, ?, CURRENT_TIMESTAMP
      FROM revs WHERE project_id = ?
    `);
    revStmt.run(projectId, revision.text, projectId);
    
    // Update project timestamp
    const updateStmt = this.db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    updateStmt.run(projectId);
  }

  getLatestRevision(projectId: string): { text: string } | undefined {
    const stmt = this.db.prepare(`
      SELECT text FROM revs 
      WHERE project_id = ? 
      ORDER BY rev DESC 
      LIMIT 1
    `);
    return stmt.get(projectId) as { text: string } | undefined;
  }

  saveYjsUpdate(projectId: string, updateData: Buffer): void {
    const stmt = this.db.prepare(`
      INSERT INTO y_updates (project_id, seq, update_data, created_at)
      SELECT ?, COALESCE(MAX(seq), 0) + 1, ?, CURRENT_TIMESTAMP
      FROM y_updates WHERE project_id = ?
    `);
    stmt.run(projectId, updateData, projectId);
  }

  initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS revs (
        project_id TEXT NOT NULL,
        rev INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, rev),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS y_updates (
        project_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        update_data BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, seq),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );
    `);
  }
}

/**
 * Create analysis queue
 */
export function createAnalysisQueue(concurrency = CONFIG.maxConcurrency, timeout = CONFIG.timeout): SimpleQueue {
  return new SimpleQueue({ 
    concurrency
  });
}