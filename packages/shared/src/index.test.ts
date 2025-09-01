import { describe, it, expect } from 'bun:test';
import {
  analyzeRequestSchema,
  createProjectSchema,
  wsMessageSchema,
  analysisResultSchema,
} from './schemas';

describe('Shared Schemas', () => {
  describe('analyzeRequestSchema', () => {
    it('should validate valid analyze request', () => {
      const validRequest = {
        text: 'name: "test"',
        requestId: 'req-123',
      };
      
      const result = analyzeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
    
    it('should reject text over 64KB limit', () => {
      const largeText = 'x'.repeat(65537); // 64KB + 1
      const invalidRequest = {
        text: largeText,
        requestId: 'req-123',
      };
      
      const result = analyzeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
    
    it('should require requestId', () => {
      const invalidRequest = {
        text: 'name: "test"',
      };
      
      const result = analyzeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });
  
  describe('createProjectSchema', () => {
    it('should validate valid project creation', () => {
      const validRequest = {
        name: 'My Project',
      };
      
      const result = createProjectSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
    
    it('should reject empty name', () => {
      const invalidRequest = {
        name: '',
      };
      
      const result = createProjectSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
    
    it('should reject name over 100 characters', () => {
      const invalidRequest = {
        name: 'x'.repeat(101),
      };
      
      const result = createProjectSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });
  
  describe('analysisResultSchema', () => {
    it('should validate successful analysis result', () => {
      const validResult = {
        requestId: 'req-123',
        errors: [],
        value: { name: 'test', version: '1.0.0' },
        graph: [
          {
            id: 'name',
            label: 'name',
            type: 'value' as const,
          },
        ],
      };
      
      const result = analysisResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });
    
    it('should validate error analysis result', () => {
      const errorResult = {
        requestId: 'req-123',
        errors: [
          {
            message: 'Invalid syntax',
            line: 1,
            column: 5,
          },
        ],
      };
      
      const result = analysisResultSchema.safeParse(errorResult);
      expect(result.success).toBe(true);
    });
  });
  
  describe('wsMessageSchema', () => {
    it('should validate hello message', () => {
      const helloMessage = {
        type: 'hello',
        version: '1.0',
      };
      
      const result = wsMessageSchema.safeParse(helloMessage);
      expect(result.success).toBe(true);
    });
    
    it('should validate join message', () => {
      const joinMessage = {
        type: 'join',
        projectId: 'project-123',
        user: {
          id: 'user-123',
          name: 'Test User',
          color: '#ff0000',
        },
      };
      
      const result = wsMessageSchema.safeParse(joinMessage);
      expect(result.success).toBe(true);
    });
    
    it('should reject invalid color format', () => {
      const joinMessage = {
        type: 'join',
        projectId: 'project-123',
        user: {
          id: 'user-123',
          name: 'Test User',
          color: 'red', // Invalid - should be hex
        },
      };
      
      const result = wsMessageSchema.safeParse(joinMessage);
      expect(result.success).toBe(false);
    });
    
    it('should validate cursor message', () => {
      const cursorMessage = {
        type: 'cursor',
        projectId: 'project-123',
        position: {
          line: 1,
          column: 5,
          selectionStart: {
            line: 1,
            column: 5,
          },
          selectionEnd: {
            line: 1,
            column: 10,
          },
        },
      };
      
      const result = wsMessageSchema.safeParse(cursorMessage);
      expect(result.success).toBe(true);
    });
  });
});