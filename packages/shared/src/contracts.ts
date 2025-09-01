// Generated from contracts/rest.openapi.json and contracts/ws.schema.json
// Do not edit manually - changes will be overwritten

import { z } from 'zod';

// Limits from contracts/limits.cue
export const LIMITS = {
  MaxTextSize: 65536, // 64KB
  MaxProjectNameLength: 100,
  MaxUserNameLength: 50,
  AnalysisTimeoutMs: 750,
  MaxConcurrency: 4,
} as const;

// HTTP API Schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
}).strict();

export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const analyzeRequestSchema = z.object({
  text: z.string().max(65536), // 64KB limit
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
  text: z.string().max(65536), // 64KB limit
});

export const errorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

// WebSocket Message Schemas
export const wsHelloSchema = z.object({
  type: z.literal('hello'),
  version: z.string().regex(/^\d+\.\d+$/).default('1.0'),
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
    name: z.string().min(1).max(50),
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
  result: z.object({
    errors: z.array(cueErrorSchema),
    value: z.unknown().optional(),
    graph: z.array(graphNodeSchema).optional(),
  }),
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