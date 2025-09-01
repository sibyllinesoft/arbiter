// Generated from contracts/
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