/**
 * Mock types and schemas to work around @arbiter/shared module resolution
 * These mirror the expected structure from the server.ts imports
 */

import { z } from 'zod';

// Request/Response schemas
export const analyzeRequestSchema = z.object({
  text: z.string().max(64 * 1024),
  requestId: z.string(),
});

export const analysisResultSchema = z.object({
  requestId: z.string(),
  errors: z.array(z.object({
    message: z.string(),
    line: z.number().optional(),
    column: z.number().optional(),
    filename: z.string().optional(),
  })),
  value: z.any().optional(),
  graph: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['object', 'array', 'value']),
    children: z.array(z.string()).optional(),
  })).optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
});

export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const saveRevisionSchema = z.object({
  text: z.string(),
});

export const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
  }),
  z.object({
    type: z.literal('join'),
    projectId: z.string(),
    user: z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
    }),
  }),
  z.object({
    type: z.literal('leave'),
    projectId: z.string(),
  }),
  z.object({
    type: z.literal('cursor'),
    projectId: z.string(),
    position: z.object({
      line: z.number(),
      column: z.number(),
    }),
  }),
  z.object({
    type: z.literal('sync'),
    projectId: z.string(),
    update: z.string(), // base64 encoded Y.js update
  }),
  z.object({
    type: z.literal('analyze'),
    projectId: z.string(),
    requestId: z.string(),
  }),
]);

// Type exports
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalysisResultSchema = z.infer<typeof analysisResultSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type SaveRevision = z.infer<typeof saveRevisionSchema>;
export type WSMessage = z.infer<typeof wsMessageSchema>;