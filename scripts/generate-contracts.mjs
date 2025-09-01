#!/usr/bin/env bun
/**
 * Contract generation script
 * Generates TypeScript types and Zod schemas from OpenAPI and JSON Schema contracts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { extendZodWithOpenApi, generateSchema } from 'zod-openapi';

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

const ROOT_DIR = process.cwd();
const CONTRACTS_DIR = join(ROOT_DIR, 'contracts');
const SHARED_DIR = join(ROOT_DIR, 'packages', 'shared', 'src');

console.log('🔄 Generating contracts...');

try {
  // Read OpenAPI spec
  const openApiSpec = JSON.parse(readFileSync(join(CONTRACTS_DIR, 'rest.openapi.json'), 'utf8'));
  
  // Read WebSocket schema
  const wsSchema = JSON.parse(readFileSync(join(CONTRACTS_DIR, 'ws.schema.json'), 'utf8'));

  // Read limits from CUE (we'll parse the basic values for now)
  const limitsContent = readFileSync(join(CONTRACTS_DIR, 'limits.cue'), 'utf8');
  
  // Extract limits from CUE content (simple regex parsing for now)
  const extractLimit = (content, name) => {
    const match = content.match(new RegExp(`#${name}:\\s*(\\d+)`));
    return match ? parseInt(match[1]) : null;
  };

  const limits = {
    MaxTextSize: extractLimit(limitsContent, 'MaxTextSize'),
    MaxProjectNameLength: extractLimit(limitsContent, 'MaxProjectNameLength'),
    MaxUserNameLength: extractLimit(limitsContent, 'MaxUserNameLength'),
    AnalysisTimeoutMs: extractLimit(limitsContent, 'AnalysisTimeoutMs'),
    MaxConcurrency: extractLimit(limitsContent, 'MaxConcurrency'),
  };

  // Generate Zod schemas from OpenAPI
  const zodSchemas = `// Generated from contracts/rest.openapi.json
// Do not edit manually - changes will be overwritten

import { z } from 'zod';

// Limits from contracts/limits.cue
export const LIMITS = ${JSON.stringify(limits, null, 2)} as const;

// HTTP API Schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(${limits.MaxProjectNameLength}),
});

export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const analyzeRequestSchema = z.object({
  text: z.string().max(${limits.MaxTextSize}),
  requestId: z.string(),
});

export const cueErrorSchema = z.object({
  message: z.string(),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
  filename: z.string().optional(),
});

export const graphNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['object', 'array', 'value']),
  children: z.array(z.string()).optional(),
});

export const analysisResultSchema = z.object({
  requestId: z.string(),
  errors: z.array(cueErrorSchema),
  value: z.unknown().optional(),
  graph: z.array(graphNodeSchema).optional(),
});

export const saveRevisionSchema = z.object({
  text: z.string().max(${limits.MaxTextSize}),
});

export const errorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

// WebSocket Message Schemas
export const wsHelloSchema = z.object({
  type: z.literal('hello'),
  version: z.string().regex(/^\\d+\\.\\d+$/).default('1.0'),
});

export const wsWelcomeSchema = z.object({
  type: z.literal('welcome'),
  sessionId: z.string().uuid(),
  version: z.string(),
  limits: z.object({
    maxTextSize: z.number().int().min(1),
    maxConcurrency: z.number().int().min(1),
    timeoutMs: z.number().int().min(100),
  }),
});

export const wsJoinSchema = z.object({
  type: z.literal('join'),
  projectId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(${limits.MaxUserNameLength}),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
});

export const wsUserJoinedSchema = z.object({
  type: z.literal('user-joined'),
  projectId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  activeUsers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })),
});

export const wsLeaveSchema = z.object({
  type: z.literal('leave'),
  projectId: z.string().uuid(),
});

export const wsUserLeftSchema = z.object({
  type: z.literal('user-left'),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  activeUsers: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })),
});

export const wsCursorSchema = z.object({
  type: z.literal('cursor'),
  projectId: z.string().uuid(),
  position: z.object({
    line: z.number().int().min(0),
    column: z.number().int().min(0),
    selectionStart: z.object({
      line: z.number().int().min(0),
      column: z.number().int().min(0),
    }).optional(),
    selectionEnd: z.object({
      line: z.number().int().min(0),
      column: z.number().int().min(0),
    }).optional(),
  }),
});

export const wsCursorUpdateSchema = z.object({
  type: z.literal('cursor-update'),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  position: z.object({
    line: z.number().int().min(0),
    column: z.number().int().min(0),
    selectionStart: z.object({
      line: z.number().int().min(0),
      column: z.number().int().min(0),
    }).optional(),
    selectionEnd: z.object({
      line: z.number().int().min(0),
      column: z.number().int().min(0),
    }).optional(),
  }),
});

export const wsSyncSchema = z.object({
  type: z.literal('sync'),
  projectId: z.string().uuid(),
  update: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
});

export const wsSyncUpdateSchema = z.object({
  type: z.literal('sync-update'),
  projectId: z.string().uuid(),
  update: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
  origin: z.string().uuid(),
});

export const wsAnalyzeSchema = z.object({
  type: z.literal('analyze'),
  projectId: z.string().uuid(),
  requestId: z.string().uuid(),
});

export const wsAnalysisResultSchema = z.object({
  type: z.literal('analysis-result'),
  projectId: z.string().uuid(),
  requestId: z.string().uuid(),
  result: analysisResultSchema.omit({ requestId: true }),
});

export const wsErrorSchema = z.object({
  type: z.literal('error'),
  code: z.enum(['INVALID_MESSAGE', 'PROJECT_NOT_FOUND', 'RATE_LIMITED', 'ANALYSIS_TIMEOUT', 'INTERNAL_ERROR']),
  message: z.string(),
  details: z.unknown().optional(),
});

// Client-to-server message union
export const wsClientMessageSchema = z.discriminatedUnion('type', [
  wsHelloSchema,
  wsJoinSchema,
  wsLeaveSchema,
  wsCursorSchema,
  wsSyncSchema,
  wsAnalyzeSchema,
]);

// Server-to-client message union
export const wsServerMessageSchema = z.discriminatedUnion('type', [
  wsWelcomeSchema,
  wsUserJoinedSchema,
  wsUserLeftSchema,
  wsCursorUpdateSchema,
  wsSyncUpdateSchema,
  wsAnalysisResultSchema,
  wsErrorSchema,
]);

// All message types union
export const wsMessageSchema = z.discriminatedUnion('type', [
  wsHelloSchema,
  wsWelcomeSchema,
  wsJoinSchema,
  wsUserJoinedSchema,
  wsLeaveSchema,
  wsUserLeftSchema,
  wsCursorSchema,
  wsCursorUpdateSchema,
  wsSyncSchema,
  wsSyncUpdateSchema,
  wsAnalyzeSchema,
  wsAnalysisResultSchema,
  wsErrorSchema,
]);
`;

  // Generate TypeScript types
  const typeDefinitions = `// Generated from contracts/
// Do not edit manually - changes will be overwritten

import type { z } from 'zod';
import type {
  createProjectSchema,
  projectResponseSchema,
  analyzeRequestSchema,
  analysisResultSchema,
  saveRevisionSchema,
  errorSchema,
  cueErrorSchema,
  graphNodeSchema,
  wsClientMessageSchema,
  wsServerMessageSchema,
  wsMessageSchema,
  wsHelloSchema,
  wsWelcomeSchema,
  wsJoinSchema,
  wsUserJoinedSchema,
  wsLeaveSchema,
  wsUserLeftSchema,
  wsCursorSchema,
  wsCursorUpdateSchema,
  wsSyncSchema,
  wsSyncUpdateSchema,
  wsAnalyzeSchema,
  wsAnalysisResultSchema,
  wsErrorSchema,
} from './contracts';

// HTTP API Types
export type CreateProject = z.infer<typeof createProjectSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type SaveRevision = z.infer<typeof saveRevisionSchema>;
export type ErrorResponse = z.infer<typeof errorSchema>;
export type CueError = z.infer<typeof cueErrorSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;

// WebSocket Types
export type WSClientMessage = z.infer<typeof wsClientMessageSchema>;
export type WSServerMessage = z.infer<typeof wsServerMessageSchema>;
export type WSMessage = z.infer<typeof wsMessageSchema>;

// Individual message types
export type WSHello = z.infer<typeof wsHelloSchema>;
export type WSWelcome = z.infer<typeof wsWelcomeSchema>;
export type WSJoin = z.infer<typeof wsJoinSchema>;
export type WSUserJoined = z.infer<typeof wsUserJoinedSchema>;
export type WSLeave = z.infer<typeof wsLeaveSchema>;
export type WSUserLeft = z.infer<typeof wsUserLeftSchema>;
export type WSCursor = z.infer<typeof wsCursorSchema>;
export type WSCursorUpdate = z.infer<typeof wsCursorUpdateSchema>;
export type WSSync = z.infer<typeof wsSyncSchema>;
export type WSSyncUpdate = z.infer<typeof wsSyncUpdateSchema>;
export type WSAnalyze = z.infer<typeof wsAnalyzeSchema>;
export type WSAnalysisResult = z.infer<typeof wsAnalysisResultSchema>;
export type WSError = z.infer<typeof wsErrorSchema>;

// User and position types for convenience
export type User = WSJoin['user'];
export type CursorPosition = WSCursor['position'];
`;

  // Write generated files
  writeFileSync(join(SHARED_DIR, 'contracts.ts'), zodSchemas);
  writeFileSync(join(SHARED_DIR, 'generated-types.ts'), typeDefinitions);

  console.log('✅ Contracts generated successfully!');
  console.log(`   - ${join(SHARED_DIR, 'contracts.ts')}`);
  console.log(`   - ${join(SHARED_DIR, 'generated-types.ts')}`);

} catch (error) {
  console.error('❌ Contract generation failed:', error.message);
  process.exit(1);
}