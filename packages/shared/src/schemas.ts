import { z } from 'zod';

// HTTP API Schemas
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export const projectResponseSchema = z.object({
  id: z.string(),
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
  line: z.number().optional(),
  column: z.number().optional(),
  filename: z.string().optional(),
  // Enhanced error translation fields
  rawMessage: z.string().optional(),
  friendlyMessage: z.string().optional(),
  explanation: z.string().optional(),
  suggestions: z.array(z.string()).optional(),
  category: z.string().optional(),
  severity: z.enum(['error', 'warning', 'info']).optional(),
  violationId: z.string().optional(),
  path: z.string().optional(),
});

// Violation data for graph nodes
export const violationDataSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  violationIds: z.array(z.string()),
  count: z.number(),
});

export const analysisResultSchema = z.object({
  requestId: z.string(),
  errors: z.array(cueErrorSchema),
  value: z.unknown().optional(),
  graph: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['object', 'array', 'value']),
    children: z.array(z.string()).optional(),
    violations: violationDataSchema.optional(),
    edges: z.array(z.object({
      target: z.string(),
      type: z.enum(['reference', 'import', 'dependency']).optional(),
    })).optional(),
  })).optional(),
});

export const saveRevisionSchema = z.object({
  text: z.string().max(65536),
});

// WebSocket Message Schemas
export const wsHelloSchema = z.object({
  type: z.literal('hello'),
  version: z.string().default('1.0'),
});

export const wsJoinSchema = z.object({
  type: z.literal('join'),
  projectId: z.string(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
});

export const wsLeaveSchema = z.object({
  type: z.literal('leave'),
  projectId: z.string(),
});

export const wsCursorSchema = z.object({
  type: z.literal('cursor'),
  projectId: z.string(),
  position: z.object({
    line: z.number(),
    column: z.number(),
    selectionStart: z.object({
      line: z.number(),
      column: z.number(),
    }).optional(),
    selectionEnd: z.object({
      line: z.number(),
      column: z.number(),
    }).optional(),
  }),
});

export const wsSyncSchema = z.object({
  type: z.literal('sync'),
  projectId: z.string(),
  update: z.string(), // base64 encoded Y.js update
});

export const wsAnalyzeSchema = z.object({
  type: z.literal('analyze'),
  projectId: z.string(),
  requestId: z.string(),
});

export const wsMessageSchema = z.discriminatedUnion('type', [
  wsHelloSchema,
  wsJoinSchema,
  wsLeaveSchema,
  wsCursorSchema,
  wsSyncSchema,
  wsAnalyzeSchema,
]);

// Type inference
export type CreateProject = z.infer<typeof createProjectSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResultSchema = z.infer<typeof analysisResultSchema>;
export type SaveRevision = z.infer<typeof saveRevisionSchema>;
export type WSMessage = z.infer<typeof wsMessageSchema>;