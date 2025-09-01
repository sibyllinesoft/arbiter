// Protocol constants and utilities

export const WS_PROTOCOL_VERSION = '1.0';
export const MAX_TEXT_SIZE = 64 * 1024; // 64KB
export const MAX_EVAL_TIME = 750; // 750ms
export const MAX_MEMORY = 128 * 1024 * 1024; // 128MB
export const RATE_LIMIT_PER_SECOND = 1;

export const HTTP_ENDPOINTS = {
  ANALYZE: '/analyze',
  PROJECTS: '/projects',
  PROJECT_BY_ID: '/projects/:id',
  PROJECT_REVISIONS: '/projects/:id/revs',
} as const;

export const WS_MESSAGE_TYPES = {
  HELLO: 'hello',
  JOIN: 'join',
  LEAVE: 'leave',
  CURSOR: 'cursor',
  SYNC: 'sync',
  ANALYZE: 'analyze',
  ANALYSIS_RESULT: 'analysis_result',
  ERROR: 'error',
} as const;

export function isYjsUpdate(data: unknown): data is ArrayBuffer | Uint8Array {
  return data instanceof ArrayBuffer || data instanceof Uint8Array;
}