/**
 * Contract validation tests
 * Tests round-trip JSON validation, schema compliance, and error handling
 */

import { describe, test, expect } from 'bun:test';
import { 
  createProjectSchema,
  projectResponseSchema,
  analyzeRequestSchema,
  analysisResultSchema,
  saveRevisionSchema,
  errorSchema,
  cueErrorSchema,
  graphNodeSchema,
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
  wsClientMessageSchema,
  wsServerMessageSchema,
  LIMITS,
} from '../src/contracts';
import type {
  CreateProject,
  ProjectResponse,
  AnalyzeRequest,
  AnalysisResult,
  WSMessage,
  WSHello,
  WSWelcome,
  WSJoin,
  CueError,
  GraphNode,
} from '../src/generated-types';

describe('Contract Validation Tests', () => {
  describe('HTTP API Schemas', () => {
    describe('createProjectSchema', () => {
      test('accepts valid project creation data', () => {
        const validData: CreateProject = {
          name: 'Test Project',
        };
        
        expect(() => createProjectSchema.parse(validData)).not.toThrow();
        expect(createProjectSchema.parse(validData)).toEqual(validData);
      });

      test('rejects empty name', () => {
        const invalidData = { name: '' };
        expect(() => createProjectSchema.parse(invalidData)).toThrow();
      });

      test('rejects name too long', () => {
        const invalidData = { name: 'x'.repeat(101) };
        expect(() => createProjectSchema.parse(invalidData)).toThrow();
      });

      test('rejects missing name', () => {
        const invalidData = {};
        expect(() => createProjectSchema.parse(invalidData)).toThrow();
      });

      test('rejects extra fields', () => {
        const invalidData = { name: 'Test', extra: 'field' };
        expect(() => createProjectSchema.parse(invalidData)).toThrow();
      });
    });

    describe('projectResponseSchema', () => {
      test('accepts valid project response', () => {
        const validData: ProjectResponse = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Project',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };

        expect(() => projectResponseSchema.parse(validData)).not.toThrow();
        expect(projectResponseSchema.parse(validData)).toEqual(validData);
      });

      test('rejects invalid UUID format', () => {
        const invalidData = {
          id: 'invalid-uuid',
          name: 'Test Project',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        };
        expect(() => projectResponseSchema.parse(invalidData)).toThrow();
      });

      test('rejects invalid datetime format', () => {
        const invalidData = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test Project',
          createdAt: 'invalid-date',
          updatedAt: '2024-01-01T00:00:00Z',
        };
        expect(() => projectResponseSchema.parse(invalidData)).toThrow();
      });
    });

    describe('analyzeRequestSchema', () => {
      test('accepts valid analyze request', () => {
        const validData: AnalyzeRequest = {
          text: 'hello: "world"',
          requestId: 'req-123',
        };

        expect(() => analyzeRequestSchema.parse(validData)).not.toThrow();
      });

      test('rejects text exceeding 64KB limit', () => {
        const invalidData = {
          text: 'x'.repeat(LIMITS.MaxTextSize + 1),
          requestId: 'req-123',
        };
        expect(() => analyzeRequestSchema.parse(invalidData)).toThrow();
      });

      test('accepts text at 64KB limit', () => {
        const validData = {
          text: 'x'.repeat(LIMITS.MaxTextSize),
          requestId: 'req-123',
        };
        expect(() => analyzeRequestSchema.parse(validData)).not.toThrow();
      });
    });

    describe('cueErrorSchema', () => {
      test('accepts minimal error', () => {
        const validData: CueError = {
          message: 'syntax error',
        };
        expect(() => cueErrorSchema.parse(validData)).not.toThrow();
      });

      test('accepts complete error with location', () => {
        const validData: CueError = {
          message: 'syntax error',
          line: 5,
          column: 10,
          filename: 'test.cue',
        };
        expect(() => cueErrorSchema.parse(validData)).not.toThrow();
      });

      test('rejects negative line numbers', () => {
        const invalidData = {
          message: 'syntax error',
          line: 0,
        };
        expect(() => cueErrorSchema.parse(invalidData)).toThrow();
      });
    });

    describe('graphNodeSchema', () => {
      test('accepts node without children', () => {
        const validData: GraphNode = {
          id: 'node-1',
          label: 'Root',
          type: 'object',
        };
        expect(() => graphNodeSchema.parse(validData)).not.toThrow();
      });

      test('accepts node with children', () => {
        const validData: GraphNode = {
          id: 'node-1',
          label: 'Root',
          type: 'object',
          children: ['node-2', 'node-3'],
        };
        expect(() => graphNodeSchema.parse(validData)).not.toThrow();
      });

      test('rejects invalid node type', () => {
        const invalidData = {
          id: 'node-1',
          label: 'Root',
          type: 'invalid',
        };
        expect(() => graphNodeSchema.parse(invalidData)).toThrow();
      });
    });
  });

  describe('WebSocket Message Schemas', () => {
    describe('wsHelloSchema', () => {
      test('accepts hello with default version', () => {
        const validData: WSHello = {
          type: 'hello',
        };
        const parsed = wsHelloSchema.parse(validData);
        expect(parsed.version).toBe('1.0');
      });

      test('accepts hello with explicit version', () => {
        const validData = {
          type: 'hello',
          version: '2.0',
        };
        expect(() => wsHelloSchema.parse(validData)).not.toThrow();
      });

      test('rejects invalid version format', () => {
        const invalidData = {
          type: 'hello',
          version: 'invalid',
        };
        expect(() => wsHelloSchema.parse(invalidData)).toThrow();
      });
    });

    describe('wsWelcomeSchema', () => {
      test('accepts valid welcome message', () => {
        const validData: WSWelcome = {
          type: 'welcome',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          version: '1.0',
          limits: {
            maxTextSize: 65536,
            maxConcurrency: 4,
            timeoutMs: 750,
          },
        };
        expect(() => wsWelcomeSchema.parse(validData)).not.toThrow();
      });

      test('rejects negative limits', () => {
        const invalidData = {
          type: 'welcome',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          version: '1.0',
          limits: {
            maxTextSize: -1,
            maxConcurrency: 4,
            timeoutMs: 750,
          },
        };
        expect(() => wsWelcomeSchema.parse(invalidData)).toThrow();
      });
    });

    describe('wsJoinSchema', () => {
      test('accepts valid join message', () => {
        const validData: WSJoin = {
          type: 'join',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          user: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Alice',
            color: '#FF0000',
          },
        };
        expect(() => wsJoinSchema.parse(validData)).not.toThrow();
      });

      test('rejects invalid color format', () => {
        const invalidData = {
          type: 'join',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          user: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Alice',
            color: 'red',
          },
        };
        expect(() => wsJoinSchema.parse(invalidData)).toThrow();
      });

      test('rejects user name too long', () => {
        const invalidData = {
          type: 'join',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          user: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'x'.repeat(51),
            color: '#FF0000',
          },
        };
        expect(() => wsJoinSchema.parse(invalidData)).toThrow();
      });
    });

    describe('wsCursorSchema', () => {
      test('accepts cursor without selection', () => {
        const validData = {
          type: 'cursor',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          position: {
            line: 5,
            column: 10,
          },
        };
        expect(() => wsCursorSchema.parse(validData)).not.toThrow();
      });

      test('accepts cursor with selection', () => {
        const validData = {
          type: 'cursor',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          position: {
            line: 5,
            column: 10,
            selectionStart: { line: 5, column: 10 },
            selectionEnd: { line: 5, column: 20 },
          },
        };
        expect(() => wsCursorSchema.parse(validData)).not.toThrow();
      });

      test('rejects negative line numbers', () => {
        const invalidData = {
          type: 'cursor',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          position: {
            line: -1,
            column: 10,
          },
        };
        expect(() => wsCursorSchema.parse(invalidData)).toThrow();
      });
    });

    describe('wsSyncSchema', () => {
      test('accepts valid base64 update', () => {
        const validData = {
          type: 'sync',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          update: 'SGVsbG8gV29ybGQ=',
        };
        expect(() => wsSyncSchema.parse(validData)).not.toThrow();
      });

      test('rejects invalid base64', () => {
        const invalidData = {
          type: 'sync',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          update: 'invalid-base64!@#',
        };
        expect(() => wsSyncSchema.parse(invalidData)).toThrow();
      });
    });

    describe('wsAnalysisResultSchema', () => {
      test('accepts analysis result with errors', () => {
        const validData = {
          type: 'analysis-result',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          requestId: '550e8400-e29b-41d4-a716-446655440002',
          result: {
            errors: [
              {
                message: 'syntax error',
                line: 5,
                column: 10,
              },
            ],
          },
        };
        expect(() => wsAnalysisResultSchema.parse(validData)).not.toThrow();
      });

      test('accepts analysis result with value and graph', () => {
        const validData = {
          type: 'analysis-result',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          requestId: '550e8400-e29b-41d4-a716-446655440002',
          result: {
            errors: [],
            value: { hello: 'world' },
            graph: [
              {
                id: 'root',
                label: 'Root',
                type: 'object',
                children: ['hello'],
              },
              {
                id: 'hello',
                label: 'hello',
                type: 'value',
              },
            ],
          },
        };
        expect(() => wsAnalysisResultSchema.parse(validData)).not.toThrow();
      });
    });
  });

  describe('Message Union Schemas', () => {
    test('wsClientMessageSchema accepts all client message types', () => {
      const messages = [
        { type: 'hello', version: '1.0' },
        {
          type: 'join',
          projectId: '550e8400-e29b-41d4-a716-446655440000',
          user: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Alice',
            color: '#FF0000',
          },
        },
        { type: 'leave', projectId: '550e8400-e29b-41d4-a716-446655440000' },
      ];

      messages.forEach((msg) => {
        expect(() => wsClientMessageSchema.parse(msg)).not.toThrow();
      });
    });

    test('wsServerMessageSchema accepts all server message types', () => {
      const messages = [
        {
          type: 'welcome',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          version: '1.0',
          limits: { maxTextSize: 65536, maxConcurrency: 4, timeoutMs: 750 },
        },
        {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Invalid message format',
        },
      ];

      messages.forEach((msg) => {
        expect(() => wsServerMessageSchema.parse(msg)).not.toThrow();
      });
    });

    test('discriminated union handles unknown message types', () => {
      const invalidMessage = { type: 'unknown', data: 'test' };
      expect(() => wsMessageSchema.parse(invalidMessage)).toThrow();
    });
  });

  describe('Round-trip JSON Validation', () => {
    test('createProject survives JSON round-trip', () => {
      const originalData: CreateProject = { name: 'Test Project' };
      const json = JSON.stringify(originalData);
      const parsed = JSON.parse(json);
      const validated = createProjectSchema.parse(parsed);
      expect(validated).toEqual(originalData);
    });

    test('analysis result survives JSON round-trip', () => {
      const originalData: AnalysisResult = {
        requestId: 'req-123',
        errors: [
          {
            message: 'syntax error',
            line: 5,
            column: 10,
            filename: 'test.cue',
          },
        ],
        value: { hello: 'world' },
        graph: [
          {
            id: 'root',
            label: 'Root',
            type: 'object',
            children: ['hello'],
          },
        ],
      };
      
      const json = JSON.stringify(originalData);
      const parsed = JSON.parse(json);
      const validated = analysisResultSchema.parse(parsed);
      expect(validated).toEqual(originalData);
    });

    test('WebSocket message survives JSON round-trip', () => {
      const originalMessage: WSMessage = {
        type: 'cursor',
        projectId: '550e8400-e29b-41d4-a716-446655440000',
        position: {
          line: 5,
          column: 10,
          selectionStart: { line: 5, column: 10 },
          selectionEnd: { line: 5, column: 20 },
        },
      };
      
      const json = JSON.stringify(originalMessage);
      const parsed = JSON.parse(json);
      const validated = wsMessageSchema.parse(parsed);
      expect(validated).toEqual(originalMessage);
    });
  });

  describe('Error Path Validation', () => {
    test('captures specific error messages for boundary violations', () => {
      try {
        createProjectSchema.parse({ name: '' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.errors[0].message).toContain('String must contain at least 1 character(s)');
      }
    });

    test('captures specific error messages for type violations', () => {
      try {
        analyzeRequestSchema.parse({ text: 123, requestId: 'test' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.errors[0].message).toContain('Expected string');
      }
    });

    test('captures specific error messages for format violations', () => {
      try {
        projectResponseSchema.parse({
          id: 'not-a-uuid',
          name: 'test',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.errors[0].message).toContain('Invalid uuid');
      }
    });
  });

  describe('Limits Configuration', () => {
    test('LIMITS contains expected constants', () => {
      expect(LIMITS.MaxTextSize).toBe(65536);
      expect(LIMITS.MaxProjectNameLength).toBe(100);
      expect(LIMITS.MaxUserNameLength).toBe(50);
      expect(LIMITS.AnalysisTimeoutMs).toBe(750);
      expect(LIMITS.MaxConcurrency).toBe(4);
    });

    test('schemas use LIMITS constants correctly', () => {
      // Test that the actual limits match what's in the schemas
      expect(() => 
        createProjectSchema.parse({ name: 'x'.repeat(LIMITS.MaxProjectNameLength) })
      ).not.toThrow();
      
      expect(() => 
        createProjectSchema.parse({ name: 'x'.repeat(LIMITS.MaxProjectNameLength + 1) })
      ).toThrow();
    });
  });
});