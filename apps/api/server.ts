/**
 * Bun HTTP+WebSocket server for CUE analysis and real-time collaboration
 * Following the TODO.md specifications for Bun-first architecture
 */

import type { ServerWebSocket } from 'bun';
import { Database } from 'bun:sqlite';
import { spawn } from 'bun';
import { randomUUID } from 'crypto';
import { mkdtemp, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
// Simple queue implementation to replace p-queue dependency
class SimpleQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  
  constructor(private options: { concurrency: number; timeout: number }) {}
  
  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          this.running++;
          const timeoutPromise = new Promise<never>((_, timeoutReject) => {
            setTimeout(() => timeoutReject(new Error('Task timeout')), this.options.timeout);
          });
          
          const result = await Promise.race([task(), timeoutPromise]);
          this.running--;
          resolve(result);
          this.processQueue();
        } catch (error) {
          this.running--;
          reject(error);
          this.processQueue();
        }
      };
      
      this.queue.push(wrappedTask);
      this.processQueue();
    });
  }
  
  private processQueue() {
    if (this.running < this.options.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      task();
    }
  }
}

import {
  analyzeRequestSchema,
  analysisResultSchema,
  createProjectSchema,
  projectResponseSchema,
  saveRevisionSchema,
  wsMessageSchema,
  translateCueErrors,
  type AnalyzeRequest,
  type AnalysisResultSchema,
  type CreateProject,
  type ProjectResponse,
  type SaveRevision,
  type WSMessage,
} from '../../packages/shared/dist/index.js';

import { 
  ExportEngine, 
  validateExportFormat, 
  getSupportedFormats,
  type ExportOptions,
  type ExportFormat 
} from './export-engine.js';

import TicketSystem, { 
  type TicketRequest, 
  type TicketResponse, 
  type VerifyStampRequest,
  type VerifyStampResponse
} from './ticket-system.js';

// Configuration
const CONFIG = {
  port: parseInt(process.env.PORT || '4001'),
  maxConcurrency: 4,
  timeout: 750, // ms
  maxTextSize: 64 * 1024, // 64KB
  maxMemory: 128 * 1024 * 1024, // 128MB
  rateLimit: 1, // requests per second per client
  dbPath: process.env.DB_PATH || './data/arbiter.db',
};

// Database setup
const db = new Database(CONFIG.dbPath, { create: true });

// Initialize database schema
db.exec(`
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

// Analysis queue with bounded concurrency
const analysisQueue = new SimpleQueue({ 
  concurrency: CONFIG.maxConcurrency,
  timeout: CONFIG.timeout,
});

// Export engine for format transformations
const exportEngine = new ExportEngine();

// Ticket system for mutation control (Rails & Guarantees)
const ticketSystem = new TicketSystem(db);

// Rate limiting
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();

interface CueError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
  // Enhanced error translation fields
  rawMessage?: string;
  friendlyMessage?: string;
  explanation?: string;
  suggestions?: string[];
  category?: string;
  severity?: 'error' | 'warning' | 'info';
  violationId?: string;
  path?: string;
}

interface ViolationData {
  severity: 'error' | 'warning' | 'info';
  violationIds: string[];
  count: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
  violations?: ViolationData;
  edges?: Array<{
    target: string;
    type?: 'reference' | 'import' | 'dependency';
  }>;
}

/**
 * Parse CUE stderr output to extract error information with enhanced translation
 */
function parseCueStderr(stderr: string): CueError[] {
  // Use the enhanced error translator from shared package
  const translatedErrors = translateCueErrors(stderr);
  
  // Convert translated errors to CueError interface with violation IDs
  return translatedErrors.map((translatedError, index) => ({
    message: translatedError.friendlyMessage || translatedError.rawMessage,
    line: translatedError.line,
    column: translatedError.column,
    filename: translatedError.filename,
    path: translatedError.path,
    // Enhanced error translation information
    rawMessage: translatedError.rawMessage,
    friendlyMessage: translatedError.friendlyMessage,
    explanation: translatedError.explanation,
    suggestions: translatedError.suggestions,
    category: translatedError.category,
    severity: translatedError.severity || 'error',
    // Generate unique violation ID for each error
    violationId: `violation_${Date.now()}_${index}`
  }));
}

/**
 * Map validation errors to graph nodes based on field paths and line numbers
 */
function mapViolationsToNodes(nodes: GraphNode[], errors: CueError[]): GraphNode[] {
  const violationMap = new Map<string, CueError[]>();
  
  // Group errors by their most likely node association
  errors.forEach(error => {
    let nodeId = 'root'; // Default to root
    
    // Try to map error to specific node using path information
    if (error.path) {
      // Extract the first segment of the path as the node ID
      const pathSegments = error.path.split('.');
      const potentialNodeId = pathSegments[0];
      
      // Check if this node exists
      if (nodes.some(node => node.id === potentialNodeId)) {
        nodeId = potentialNodeId;
      }
    } else if (error.line) {
      // For errors with line numbers, try to estimate which node they belong to
      // This is a heuristic approach - in a real implementation, you might
      // need more sophisticated source position mapping
      const nodeIndex = Math.min(error.line - 1, nodes.length - 1);
      if (nodes[nodeIndex]) {
        nodeId = nodes[nodeIndex].id;
      }
    }
    
    if (!violationMap.has(nodeId)) {
      violationMap.set(nodeId, []);
    }
    violationMap.get(nodeId)!.push(error);
  });
  
  // Apply violations to nodes
  return nodes.map(node => {
    const nodeErrors = violationMap.get(node.id) || [];
    
    if (nodeErrors.length > 0) {
      // Determine overall severity (error > warning > info)
      const severities = nodeErrors.map(e => e.severity || 'error');
      let overallSeverity: 'error' | 'warning' | 'info' = 'info';
      
      if (severities.includes('error')) {
        overallSeverity = 'error';
      } else if (severities.includes('warning')) {
        overallSeverity = 'warning';
      }
      
      return {
        ...node,
        violations: {
          severity: overallSeverity,
          violationIds: nodeErrors.map(e => e.violationId!).filter(Boolean),
          count: nodeErrors.length
        }
      };
    }
    
    return node;
  });
}

/**
 * Build a violation-aware graph from CUE value (top-level keys → nodes with violation data)
 */
function buildGraph(value: any, errors: CueError[] = []): GraphNode[] {
  let nodes: GraphNode[] = [];
  
  if (typeof value !== 'object' || value === null) {
    // If we have errors but no value, create placeholder nodes for error display
    if (errors.length > 0) {
      nodes.push({
        id: 'validation_errors',
        label: `Validation Issues (${errors.length})`,
        type: 'object'
      });
    }
  } else {
    // Cap graph size for performance
    const keys = Object.keys(value);
    if (keys.length > 200) {
      nodes.push({
        id: 'summary',
        label: `Large object (${keys.length} keys)`,
        type: 'object',
      });
    } else {
      for (const key of keys) {
        const val = value[key];
        let type: 'object' | 'array' | 'value' = 'value';
        
        if (Array.isArray(val)) {
          type = 'array';
        } else if (typeof val === 'object' && val !== null) {
          type = 'object';
        }
        
        // Detect dependencies/references in the value
        const edges = detectDependencies(key, val);
        
        nodes.push({
          id: key,
          label: key,
          type,
          children: type === 'object' ? Object.keys(val).slice(0, 10) : undefined,
          edges: edges.length > 0 ? edges : undefined,
        });
      }
    }
  }
  
  // Map violations to nodes
  nodes = mapViolationsToNodes(nodes, errors);
  
  return nodes;
}

/**
 * Detect dependencies/references from CUE values
 */
function detectDependencies(key: string, value: any): Array<{ target: string; type?: 'reference' | 'import' | 'dependency' }> {
  const edges: Array<{ target: string; type?: 'reference' | 'import' | 'dependency' }> = [];
  
  // Simple heuristic: look for string values that might be references
  if (typeof value === 'string') {
    // Check if value looks like a reference to another field
    if (value.startsWith('#') || value.includes('.')) {
      const referencedField = value.replace(/^#/, '').split('.')[0];
      if (referencedField && referencedField !== key) {
        edges.push({
          target: referencedField,
          type: 'reference'
        });
      }
    }
  } else if (typeof value === 'object' && value !== null) {
    // Look for references in object values
    Object.values(value).forEach((val: any) => {
      if (typeof val === 'string' && (val.startsWith('#') || val.includes('.'))) {
        const referencedField = val.replace(/^#/, '').split('.')[0];
        if (referencedField && referencedField !== key) {
          edges.push({
            target: referencedField,
            type: 'reference'
          });
        }
      }
    });
  }
  
  return edges;
}

/**
 * Analyze CUE text using the cue CLI
 */
async function analyzeCue(text: string, requestId: string): Promise<AnalysisResultSchema> {
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
      setTimeout(() => reject(new Error('Analysis timeout')), CONFIG.timeout);
    });
    
    try {
      await Promise.race([proc.exited, timeoutPromise]);
      
      if (proc.exitCode === 0) {
        // Success - parse output and build violation-aware graph
        const stdout = await new Response(proc.stdout).text();
        const value = JSON.parse(stdout);
        const errors: CueError[] = []; // No errors in successful case
        const graph = buildGraph(value, errors);
        
        return {
          requestId,
          errors,
          value,
          graph,
        };
      } else {
        // Error - parse stderr with enhanced translation
        const stderr = await new Response(proc.stderr).text();
        const errors = parseCueStderr(stderr);
        
        // Still attempt to build a graph for visualization even with errors
        // This helps show where violations occur in the structure
        const graph = buildGraph(null, errors);
        
        return {
          requestId,
          errors,
          graph: graph.length > 0 ? graph : undefined,
        };
      }
    } catch (error) {
      proc.kill();
      if (error instanceof Error && error.message === 'Analysis timeout') {
        return {
          requestId,
          errors: [{ message: 'Analysis timed out (750ms limit exceeded)' }],
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
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  let bucket = rateLimitMap.get(clientId);
  
  if (!bucket) {
    bucket = { tokens: CONFIG.rateLimit, lastRefill: now };
    rateLimitMap.set(clientId, bucket);
  }
  
  // Refill tokens (1 token per second)
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / 1000);
  
  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(CONFIG.rateLimit, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
  
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }
  
  return false;
}

/**
 * WebSocket connection tracking
 */
interface WSConnection {
  ws: ServerWebSocket<unknown>;
  clientId: string;
  projectId?: string;
  user?: {
    id: string;
    name: string;
    color: string;
  };
}

const connections = new Map<ServerWebSocket<unknown>, WSConnection>();
const projectConnections = new Map<string, Set<WSConnection>>();

/**
 * Broadcast message to all connections in a project
 */
function broadcastToProject(projectId: string, message: any, excludeWs?: ServerWebSocket<unknown>) {
  const projectConns = projectConnections.get(projectId);
  if (!projectConns) return;
  
  const messageStr = JSON.stringify(message);
  for (const conn of projectConns) {
    if (conn.ws !== excludeWs && conn.ws.readyState === 1) {
      conn.ws.send(messageStr);
    }
  }
}

/**
 * Generate execution plan from epic IR
 */
function generateExecutionPlan(epicIR: any): Array<{
  id: string;
  name: string;
  type: 'generate' | 'validate' | 'transform';
  dependencies: string[];
  estimated_duration: string;
  resources: string[];
}> {
  // Default plan structure for any valid epic
  const basePlan = [
    {
      id: 'validate_inputs',
      name: 'Validate Input Specifications',
      type: 'validate' as const,
      dependencies: [],
      estimated_duration: '30s',
      resources: ['cue', 'validator']
    },
    {
      id: 'generate_artifacts',
      name: 'Generate Code Artifacts',
      type: 'generate' as const,
      dependencies: ['validate_inputs'],
      estimated_duration: '2m',
      resources: ['templates', 'generator']
    },
    {
      id: 'validate_outputs',
      name: 'Validate Generated Outputs',
      type: 'validate' as const,
      dependencies: ['generate_artifacts'],
      estimated_duration: '45s',
      resources: ['linters', 'tests']
    }
  ];

  // If epicIR has specific steps, generate more detailed plan
  if (epicIR && typeof epicIR === 'object' && epicIR.steps) {
    const customPlan = epicIR.steps.map((step: any, index: number) => ({
      id: `step_${index}`,
      name: step.name || `Step ${index + 1}`,
      type: step.type || 'generate',
      dependencies: step.dependencies || (index > 0 ? [`step_${index - 1}`] : []),
      estimated_duration: step.duration || '1m',
      resources: step.resources || ['generator']
    }));
    
    return customPlan.length > 0 ? customPlan : basePlan;
  }
  
  return basePlan;
}

/**
 * Generate execution guards from epic IR  
 */
function generateExecutionGuards(epicIR: any): Array<{
  id: string;
  name: string;
  condition: string;
  action: 'block' | 'warn' | 'continue';
  timeout: string;
}> {
  const defaultGuards = [
    {
      id: 'input_validation',
      name: 'Input Validation Guard',
      condition: 'All inputs must be valid CUE',
      action: 'block' as const,
      timeout: '30s'
    },
    {
      id: 'resource_availability',
      name: 'Resource Availability Guard',
      condition: 'Required tools and templates must be available',
      action: 'block' as const,
      timeout: '15s'
    },
    {
      id: 'output_quality',
      name: 'Output Quality Guard',
      condition: 'Generated code must pass basic quality checks',
      action: 'warn' as const,
      timeout: '1m'
    }
  ];

  // Add custom guards from epic if available
  if (epicIR && epicIR.guards) {
    const customGuards = Object.entries(epicIR.guards).map(([key, guard]: [string, any]) => ({
      id: key,
      name: guard.name || key,
      condition: guard.condition || 'Custom guard condition',
      action: guard.action || 'warn',
      timeout: guard.timeout || '30s'
    }));
    
    return [...defaultGuards, ...customGuards];
  }
  
  return defaultGuards;
}

/**
 * Generate diff summary between versions
 */
function generateDiffSummary(epicIR: any, previousVersion?: string): {
  added: string[];
  removed: string[];
  modified: string[];
  summary: string;
} {
  // Basic diff structure - in a real implementation this would compare actual versions
  const diff = {
    added: [] as string[],
    removed: [] as string[],
    modified: [] as string[],
    summary: 'No previous version available for comparison'
  };
  
  if (previousVersion) {
    // Simulate diff analysis
    diff.summary = 'Changes detected between versions';
    if (epicIR && typeof epicIR === 'object') {
      const keys = Object.keys(epicIR);
      if (keys.length > 0) {
        diff.modified = keys.slice(0, 3); // Simulate some modifications
        diff.added = keys.length > 3 ? [keys[keys.length - 1]] : [];
        diff.summary = `${diff.modified.length} modified, ${diff.added.length} added, ${diff.removed.length} removed`;
      }
    }
  }
  
  return diff;
}

/**
 * Estimate plan duration
 */
function estimatePlanDuration(plan: Array<{ estimated_duration: string }>): string {
  // Simple duration estimation - sum all step durations
  let totalSeconds = 0;
  
  plan.forEach(step => {
    const duration = step.estimated_duration;
    if (duration.includes('s')) {
      totalSeconds += parseInt(duration);
    } else if (duration.includes('m')) {
      totalSeconds += parseInt(duration) * 60;
    }
  });
  
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  } else {
    const minutes = Math.ceil(totalSeconds / 60);
    return `${minutes}m`;
  }
}

/**
 * Assess plan risk level
 */
function assessPlanRisk(plan: any[], guards: any[]): 'low' | 'medium' | 'high' {
  const blockingGuards = guards.filter(g => g.action === 'block');
  const complexSteps = plan.filter(p => p.type === 'transform' || p.dependencies.length > 2);
  
  if (blockingGuards.length > 2 || complexSteps.length > 3) {
    return 'high';
  } else if (blockingGuards.length > 0 || complexSteps.length > 0) {
    return 'medium';  
  } else {
    return 'low';
  }
}

/**
 * Execute epic (mock implementation)
 */
async function executeEpic(epicIR: any, options: { apply: boolean; dryRun: boolean }): Promise<{
  success: boolean;
  results: Array<{
    step: string;
    status: 'success' | 'failed' | 'skipped';
    output?: string;
    duration: string;
  }>;
  artifacts: string[];
  duration: string;
}> {
  const startTime = Date.now();
  
  // Mock execution results
  const results = [
    {
      step: 'validate_inputs',
      status: 'success' as const,
      output: 'All inputs validated successfully',
      duration: '500ms'
    },
    {
      step: 'generate_artifacts', 
      status: options.apply ? 'success' as const : 'skipped' as const,
      output: options.apply ? 'Generated 3 artifacts' : 'Skipped (dry run)',
      duration: '1.2s'
    },
    {
      step: 'validate_outputs',
      status: options.apply ? 'success' as const : 'skipped' as const, 
      output: options.apply ? 'All outputs valid' : 'Skipped (dry run)',
      duration: '800ms'
    }
  ];
  
  const artifacts = options.apply ? [
    'generated/types.ts',
    'generated/schema.cue', 
    'generated/tests.spec.ts'
  ] : [];
  
  const endTime = Date.now();
  const duration = `${endTime - startTime}ms`;
  
  return {
    success: true,
    results,
    artifacts,
    duration
  };
}

/**
 * Generate JUnit test report
 */
function generateJUnitReport(executionResult: any): string {
  const { results, duration } = executionResult;
  const testCount = results.length;
  const failures = results.filter((r: any) => r.status === 'failed').length;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="epic-execution" tests="${testCount}" failures="${failures}" time="${duration}">`;
  
  results.forEach((result: any) => {
    xml += `
    <testcase name="${result.step}" time="${result.duration}">`;
    
    if (result.status === 'failed') {
      xml += `
      <failure message="Step failed">${result.output || 'No output'}</failure>`;
    } else if (result.status === 'skipped') {
      xml += `
      <skipped message="Step skipped">${result.output || 'Dry run mode'}</skipped>`;
    }
    
    xml += `
    </testcase>`;
  });
  
  xml += `
  </testsuite>
</testsuites>`;
  
  return xml;
}

/**
 * Generate JSON test report
 */
function generateJsonReport(executionResult: any): object {
  return {
    apiVersion: 'arbiter.dev/v1',
    type: 'execution-report',
    timestamp: new Date().toISOString(),
    summary: {
      total: executionResult.results.length,
      successful: executionResult.results.filter((r: any) => r.status === 'success').length,
      failed: executionResult.results.filter((r: any) => r.status === 'failed').length,
      skipped: executionResult.results.filter((r: any) => r.status === 'skipped').length,
      duration: executionResult.duration
    },
    results: executionResult.results,
    artifacts: executionResult.artifacts,
    success: executionResult.success
  };
}

/**
 * Bun server with HTTP and WebSocket support
 */
const server = Bun.serve({
  port: CONFIG.port,
  
  async fetch(req, server) {
    const url = new URL(req.url);
    
    // Upgrade to WebSocket
    if (server.upgrade(req)) {
      return; // Handled by websocket handlers below
    }
    
    // CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': req.headers.get('origin') || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-id',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hours
    };
    
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Route HTTP requests
    if (req.method === 'POST' && url.pathname === '/analyze') {
      try {
        const body = await req.json();
        const parsed = analyzeRequestSchema.parse(body);
        
        // Check rate limit
        const clientId = req.headers.get('x-client-id') || 'anonymous';
        if (!checkRateLimit(clientId)) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Queue analysis
        const result = await analysisQueue.add(() => analyzeCue(parsed.text, parsed.requestId));
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Invalid request' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Projects CRUD (basic implementation)
    if (req.method === 'GET' && url.pathname === '/projects') {
      const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
      const projects = stmt.all();
      return new Response(JSON.stringify(projects), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (req.method === 'POST' && url.pathname === '/projects') {
      try {
        const body = await req.json();
        const parsed = createProjectSchema.parse(body);
        const id = randomUUID();
        const now = new Date().toISOString();
        
        const stmt = db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)');
        stmt.run(id, parsed.name, now, now);
        
        const project: ProjectResponse = {
          id,
          name: parsed.name,
          createdAt: now,
          updatedAt: now,
        };
        
        return new Response(JSON.stringify(project), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Invalid request' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Get project by ID
    const projectMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
    if (req.method === 'GET' && projectMatch) {
      const projectId = projectMatch[1];
      const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
      const project = stmt.get(projectId);
      
      if (!project) {
        return new Response(JSON.stringify({ error: 'Project not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify(project), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Save revision
    const revMatch = url.pathname.match(/^\/projects\/([^/]+)\/revisions$/);
    if (req.method === 'POST' && revMatch) {
      const projectId = revMatch[1];
      
      try {
        const body = await req.json();
        const parsed = saveRevisionSchema.parse(body);
        
        // Check if project exists
        const projectStmt = db.prepare('SELECT id FROM projects WHERE id = ?');
        const project = projectStmt.get(projectId);
        
        if (!project) {
          return new Response(JSON.stringify({ error: 'Project not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Insert new revision
        const revStmt = db.prepare(`
          INSERT INTO revs (project_id, rev, text, created_at)
          SELECT ?, COALESCE(MAX(rev), 0) + 1, ?, CURRENT_TIMESTAMP
          FROM revs WHERE project_id = ?
        `);
        revStmt.run(projectId, parsed.text, projectId);
        
        // Update project timestamp
        const updateStmt = db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        updateStmt.run(projectId);
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Invalid request' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Export endpoints
    if (req.method === 'POST' && url.pathname === '/export') {
      try {
        const body = await req.json();
        
        // Validate request body
        if (!body.text || typeof body.text !== 'string') {
          return new Response(JSON.stringify({ 
            error: 'Missing or invalid "text" field' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (!body.format || typeof body.format !== 'string') {
          return new Response(JSON.stringify({ 
            error: 'Missing or invalid "format" field',
            supportedFormats: getSupportedFormats().map(f => f.format)
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Validate export format
        if (!validateExportFormat(body.format)) {
          return new Response(JSON.stringify({
            error: `Unsupported export format: ${body.format}`,
            supportedFormats: getSupportedFormats()
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Check rate limit
        const clientId = req.headers.get('x-client-id') || 'anonymous';
        if (!checkRateLimit(clientId)) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Perform export
        const exportOptions: ExportOptions = {
          format: body.format as ExportFormat,
          strict: body.strict || false,
          includeExamples: body.includeExamples || false,
          outputMode: body.outputMode || 'single'
        };
        
        const result = await exportEngine.export(body.text, exportOptions);
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Export failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // List supported export formats
    if (req.method === 'GET' && url.pathname === '/export/formats') {
      const formats = getSupportedFormats();
      return new Response(JSON.stringify({
        success: true,
        formats
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // V1 API Endpoints - Core Arbiter functionality
    
    // POST /v1/ticket - Request mutation ticket (Rails implementation)
    if (req.method === 'POST' && url.pathname === '/v1/ticket') {
      try {
        const body = await req.json();
        
        // Validate request
        if (!body.scope || typeof body.scope !== 'string') {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "scope" field. Must be 64-character hex plan hash.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const ticketRequest: TicketRequest = {
          scope: body.scope,
          expires: body.expires
        };

        // Check rate limit
        const clientId = req.headers.get('x-client-id') || 'anonymous';
        if (!checkRateLimit(clientId)) {
          return new Response(JSON.stringify({ 
            apiVersion: 'arbiter.dev/v1',
            error: 'Rate limit exceeded' 
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Issue ticket
        const ticket = await ticketSystem.issueTicket(ticketRequest);
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          ticketId: ticket.ticketId,
          expiresAt: ticket.expiresAt.toISOString(),
          planHash: ticket.planHash
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          error: error instanceof Error ? error.message : 'Ticket issuance failed'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // POST /v1/verify - Verify stamp HMAC
    if (req.method === 'POST' && url.pathname === '/v1/verify') {
      try {
        const body = await req.json();
        
        // Validate request
        const requiredFields = ['stamp', 'repoSHA', 'planHash', 'ticketId'];
        for (const field of requiredFields) {
          if (!body[field] || typeof body[field] !== 'string') {
            return new Response(JSON.stringify({
              apiVersion: 'arbiter.dev/v1',
              error: `Missing or invalid "${field}" field`
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        const verifyRequest: VerifyStampRequest = {
          stamp: body.stamp,
          repoSHA: body.repoSHA,
          planHash: body.planHash,
          ticketId: body.ticketId,
          fileContent: body.fileContent
        };

        // Verify stamp
        const result = await ticketSystem.verifyStamp(verifyRequest);
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          valid: result.valid,
          message: result.message,
          violationId: result.violationId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          valid: false,
          error: error instanceof Error ? error.message : 'Verification failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // POST /execute/epic - Execute epic with ticket validation  
    if (req.method === 'POST' && url.pathname === '/execute/epic') {
      try {
        const body = await req.json();
        
        // Validate request
        if (!body.ticketId || typeof body.ticketId !== 'string') {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "ticketId" field'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (!body.mutations || !Array.isArray(body.mutations)) {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "mutations" field. Must be array.'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Apply mutations with ticket validation
        const result = await ticketSystem.applyMutations(body.ticketId, body.mutations);
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          success: result.success,
          stamps: result.stamps,
          errors: result.errors
        }), {
          status: result.success ? 200 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // GET /v1/ticket/stats - Get ticket system statistics
    if (req.method === 'GET' && url.pathname === '/v1/ticket/stats') {
      try {
        const stats = ticketSystem.getStats();
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          stats: {
            activeTickets: stats.activeTickets,
            stampHistory: stats.stampHistory,
            oldestTicket: stats.oldestTicket?.toISOString()
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          error: error instanceof Error ? error.message : 'Stats retrieval failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // POST /v1/validate/assembly - Validate assembly specification
    if (req.method === 'POST' && url.pathname === '/v1/validate/assembly') {
      try {
        const body = await req.json();
        
        if (!body.content || typeof body.content !== 'string') {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "content" field'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Validate the assembly specification
        const requestId = randomUUID();
        const result = await analyzeCue(body.content, requestId);
        
        // Convert to v1 API format
        const diagnostics = result.errors?.map(error => ({
          message: error.friendlyMessage || error.message,
          severity: error.severity || 'error',
          line: error.line,
          column: error.column,
          path: error.path,
          violationId: error.violationId,
          category: error.category,
          suggestions: error.suggestions || []
        })) || [];
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          ir: result.value || null,
          diagnostics,
          graph: result.graph,
          valid: diagnostics.filter(d => d.severity === 'error').length === 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          error: error instanceof Error ? error.message : 'Validation failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // POST /v1/validate/epic - Validate epic specification  
    if (req.method === 'POST' && url.pathname === '/v1/validate/epic') {
      try {
        const body = await req.json();
        
        if (!body.content || typeof body.content !== 'string') {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "content" field'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Validate the epic specification (similar to assembly but with epic-specific rules)
        const requestId = randomUUID();
        const result = await analyzeCue(body.content, requestId);
        
        const diagnostics = result.errors?.map(error => ({
          message: error.friendlyMessage || error.message,
          severity: error.severity || 'error',
          line: error.line,
          column: error.column,
          path: error.path,
          violationId: error.violationId,
          category: error.category,
          suggestions: error.suggestions || []
        })) || [];
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          ir: result.value || null,
          diagnostics,
          valid: diagnostics.filter(d => d.severity === 'error').length === 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          error: error instanceof Error ? error.message : 'Epic validation failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // POST /v1/plan/epic - Generate execution plan from epic
    if (req.method === 'POST' && url.pathname === '/v1/plan/epic') {
      try {
        const body = await req.json();
        
        if (!body.content || typeof body.content !== 'string') {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "content" field'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // First validate the epic
        const requestId = randomUUID();
        const validationResult = await analyzeCue(body.content, requestId);
        
        if (validationResult.errors && validationResult.errors.length > 0) {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Epic validation failed',
            diagnostics: validationResult.errors.map(error => ({
              message: error.friendlyMessage || error.message,
              severity: error.severity || 'error',
              line: error.line,
              column: error.column,
              path: error.path
            }))
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Generate execution plan from validated epic
        const epicIR = validationResult.value;
        const plan = generateExecutionPlan(epicIR);
        const guards = generateExecutionGuards(epicIR);
        const diff = generateDiffSummary(epicIR, body.previousVersion);
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          plan,
          guards,
          diff,
          estimatedDuration: estimatePlanDuration(plan),
          riskLevel: assessPlanRisk(plan, guards)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          error: error instanceof Error ? error.message : 'Plan generation failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // POST /v1/execute/epic - Execute epic with optional apply
    if (req.method === 'POST' && url.pathname === '/v1/execute/epic') {
      try {
        const body = await req.json();
        const url = new URL(req.url);
        const shouldApply = url.searchParams.get('apply') === '1';
        
        if (!body.content || typeof body.content !== 'string') {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Missing or invalid "content" field'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Validate and generate plan first
        const requestId = randomUUID();
        const validationResult = await analyzeCue(body.content, requestId);
        
        if (validationResult.errors && validationResult.errors.length > 0) {
          return new Response(JSON.stringify({
            apiVersion: 'arbiter.dev/v1',
            error: 'Epic validation failed before execution',
            applied: false,
            diagnostics: validationResult.errors
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const epicIR = validationResult.value;
        const executionResult = await executeEpic(epicIR, { 
          apply: shouldApply,
          dryRun: !shouldApply
        });
        
        // Generate test reports in standard formats
        const junitReport = generateJUnitReport(executionResult);
        const jsonReport = generateJsonReport(executionResult);
        
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          applied: shouldApply,
          success: executionResult.success,
          results: executionResult.results,
          junit: junitReport,
          report: jsonReport,
          artifacts: executionResult.artifacts,
          duration: executionResult.duration
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          apiVersion: 'arbiter.dev/v1',
          applied: false,
          error: error instanceof Error ? error.message : 'Execution failed'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // GET /v1/profile/library/surface - Library surface analysis profile
    if (req.method === 'GET' && url.pathname === '/v1/profile/library/surface') {
      return new Response(JSON.stringify({
        apiVersion: 'arbiter.dev/v1',
        profile: {
          name: 'library/surface',
          version: '1.0.0',
          description: 'Surface API analysis for library projects',
          rules: [
            {
              id: 'public-api-documented',
              description: 'All public APIs must have documentation',
              severity: 'error',
              enabled: true
            },
            {
              id: 'breaking-changes-flagged',
              description: 'Breaking changes must be explicitly flagged',
              severity: 'error', 
              enabled: true
            },
            {
              id: 'semver-compliance',
              description: 'Version bumps must follow semantic versioning',
              severity: 'warning',
              enabled: true
            },
            {
              id: 'surface-stability',
              description: 'Public surface should be stable across patch versions',
              severity: 'info',
              enabled: true
            }
          ],
          gates: {
            'surface-analysis': {
              required: true,
              timeout: '30s',
              failureAction: 'block'
            },
            'breaking-change-detection': {
              required: true,
              timeout: '15s', 
              failureAction: 'warn'
            }
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // GET /v1/profile/cli/check - CLI validation profile
    if (req.method === 'GET' && url.pathname === '/v1/profile/cli/check') {
      return new Response(JSON.stringify({
        apiVersion: 'arbiter.dev/v1',
        profile: {
          name: 'cli/check',
          version: '1.0.0',
          description: 'Validation profile for CLI applications',
          rules: [
            {
              id: 'command-help-available',
              description: 'All commands must provide --help output',
              severity: 'error',
              enabled: true
            },
            {
              id: 'exit-codes-documented',
              description: 'Exit codes must be documented and consistent',
              severity: 'warning',
              enabled: true
            },
            {
              id: 'subcommand-discovery',
              description: 'Subcommands should be discoverable via help',
              severity: 'info',
              enabled: true
            },
            {
              id: 'error-messages-helpful',
              description: 'Error messages should suggest corrective actions',
              severity: 'info',
              enabled: true
            }
          ],
          gates: {
            'help-validation': {
              required: true,
              timeout: '10s',
              failureAction: 'block'
            },
            'exit-code-consistency': {
              required: false,
              timeout: '5s',
              failureAction: 'warn'
            }
          }
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Health endpoint
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('Not Found', { 
      status: 404,
      headers: corsHeaders,
    });
  },
  
  websocket: {
    open(ws) {
      const clientId = randomUUID();
      const connection: WSConnection = {
        ws,
        clientId,
      };
      connections.set(ws, connection);
      
      // Send hello message
      ws.send(JSON.stringify({ 
        type: 'hello',
        clientId,
        version: '1.0',
      }));
    },
    
    message(ws, message) {
      const connection = connections.get(ws);
      if (!connection) return;
      
      try {
        let parsed: WSMessage;
        
        // Handle both JSON messages and Y.js binary updates
        if (typeof message === 'string') {
          const data = JSON.parse(message);
          parsed = wsMessageSchema.parse(data);
        } else {
          // Binary Y.js update - handle separately
          // For now, just echo back (basic Y.js relay)
          if (connection.projectId) {
            broadcastToProject(connection.projectId, message, ws);
          }
          return;
        }
        
        switch (parsed.type) {
          case 'hello':
            // Already handled in open
            break;
            
          case 'join':
            // Leave previous project if any
            if (connection.projectId) {
              const prevProjectConns = projectConnections.get(connection.projectId);
              if (prevProjectConns) {
                prevProjectConns.delete(connection);
                if (prevProjectConns.size === 0) {
                  projectConnections.delete(connection.projectId);
                }
              }
            }
            
            // Join new project
            connection.projectId = parsed.projectId;
            connection.user = parsed.user;
            
            let projectConns = projectConnections.get(parsed.projectId);
            if (!projectConns) {
              projectConns = new Set();
              projectConnections.set(parsed.projectId, projectConns);
            }
            projectConns.add(connection);
            
            // Send project snapshot (Y.js document state would go here)
            // For now, just acknowledge join
            ws.send(JSON.stringify({
              type: 'joined',
              projectId: parsed.projectId,
            }));
            
            // Notify other users
            broadcastToProject(parsed.projectId, {
              type: 'user-joined',
              user: parsed.user,
            }, ws);
            break;
            
          case 'leave':
            if (connection.projectId === parsed.projectId) {
              const projectConns = projectConnections.get(parsed.projectId);
              if (projectConns) {
                projectConns.delete(connection);
                if (projectConns.size === 0) {
                  projectConnections.delete(parsed.projectId);
                }
              }
              
              // Notify other users
              if (connection.user) {
                broadcastToProject(parsed.projectId, {
                  type: 'user-left',
                  user: connection.user,
                }, ws);
              }
              
              connection.projectId = undefined;
              connection.user = undefined;
            }
            break;
            
          case 'cursor':
            if (connection.projectId === parsed.projectId) {
              broadcastToProject(parsed.projectId, {
                type: 'cursor',
                user: connection.user,
                position: parsed.position,
              }, ws);
            }
            break;
            
          case 'sync':
            // Y.js sync message - persist and broadcast
            if (connection.projectId === parsed.projectId) {
              // Store Y.js update
              const stmt = db.prepare(`
                INSERT INTO y_updates (project_id, seq, update_data, created_at)
                SELECT ?, COALESCE(MAX(seq), 0) + 1, ?, CURRENT_TIMESTAMP
                FROM y_updates WHERE project_id = ?
              `);
              const updateBuffer = Buffer.from(parsed.update, 'base64');
              stmt.run(parsed.projectId, updateBuffer, parsed.projectId);
              
              // Broadcast to other clients
              broadcastToProject(parsed.projectId, parsed, ws);
            }
            break;
            
          case 'analyze':
            if (connection.projectId === parsed.projectId) {
              // Get current document text from Y.js or latest revision
              // For now, use latest revision as fallback
              const stmt = db.prepare(`
                SELECT text FROM revs 
                WHERE project_id = ? 
                ORDER BY rev DESC 
                LIMIT 1
              `);
              const revision = stmt.get(parsed.projectId) as { text: string } | undefined;
              
              if (revision) {
                // Queue analysis and broadcast result
                analysisQueue.add(async () => {
                  const result = await analyzeCue(revision.text, parsed.requestId);
                  broadcastToProject(parsed.projectId, {
                    type: 'analysis',
                    ...result,
                  });
                });
              }
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        }));
      }
    },
    
    close(ws) {
      const connection = connections.get(ws);
      if (!connection) return;
      
      // Clean up project connections
      if (connection.projectId) {
        const projectConns = projectConnections.get(connection.projectId);
        if (projectConns) {
          projectConns.delete(connection);
          if (projectConns.size === 0) {
            projectConnections.delete(connection.projectId);
          }
        }
        
        // Notify other users
        if (connection.user) {
          broadcastToProject(connection.projectId, {
            type: 'user-left',
            user: connection.user,
          });
        }
      }
      
      connections.delete(ws);
    },
  },
});

console.log(`🚀 Arbiter API server running on http://localhost:${CONFIG.port}`);
console.log(`📊 Analysis queue: ${CONFIG.maxConcurrency} concurrent workers`);
console.log(`⏱️  Analysis timeout: ${CONFIG.timeout}ms`);
console.log(`💾 Database: ${CONFIG.dbPath}`);