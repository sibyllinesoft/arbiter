/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreateFragmentRequest,
  Fragment,
  FreezeRequest,
  IRKind,
  ProblemDetails,
  Project,
  ValidationRequest,
} from '../../types/api';
import { ApiError, ApiService, apiService } from '../api';

// Create proper mock Response object
const createMockResponse = (init: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<any>;
  headers?: Record<string, string>;
}) => {
  const headers = new Map(Object.entries(init.headers || {}));

  // Create a proper Response-like object
  const mockResponse = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) || null,
    },
    json: init.json || vi.fn().mockResolvedValue({}),
  };

  return mockResponse;
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Test data
const mockProject: Project = {
  id: 'project-1',
  name: 'Test Project',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockFragment: Fragment = {
  id: 'fragment-1',
  project_id: 'project-1',
  path: 'test.cue',
  content: 'package test\n\nfoo: "bar"',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
};

const mockErrorDetails: ProblemDetails = {
  type: 'https://example.com/problem',
  title: 'Bad Request',
  status: 400,
  detail: 'Invalid input provided',
  instance: '/api/projects',
};

describe('ApiError', () => {
  it('should create error with message and status', () => {
    const error = new ApiError('Test error', 500);

    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(500);
    expect(error.details).toBeUndefined();
  });

  it('should create error with details', () => {
    const error = new ApiError('Test error', 400, mockErrorDetails);

    expect(error.name).toBe('ApiError');
    expect(error.message).toBe('Test error');
    expect(error.status).toBe(400);
    expect(error.details).toEqual(mockErrorDetails);
  });

  it('should be instance of Error', () => {
    const error = new ApiError('Test error', 500);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ApiService', () => {
  let service: ApiService;

  beforeEach(() => {
    service = new ApiService();
    mockFetch.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeInstanceOf(ApiService);
    });

    it('should set authentication token', () => {
      const token = 'test-token';
      service.setAuthToken(token);

      // Verify by making a request and checking headers
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({}),
        })
      );

      service.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        })
      );
    });

    it('should clear authentication token', () => {
      service.setAuthToken('test-token');
      service.clearAuthToken();

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({}),
        })
      );

      service.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      );
    });
  });

  describe('request method', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockResponse),
        })
      );

      await service.getProjects();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should make successful POST request with body', async () => {
      const requestBody = { name: 'Test Project' };
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 201,
          json: vi.fn().mockResolvedValue(mockProject),
        })
      );

      await service.createProject('Test Project');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle 204 no-content responses', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 204,
          headers: { 'content-length': '0' },
        })
      );

      // deleteProject returns void, so we test using a method that returns the request result
      const result = await (service as any).request('/test', { method: 'DELETE' });

      expect(result).toEqual({});
    });

    it('should handle empty content-length responses', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          headers: { 'content-length': '0' },
        })
      );

      // Test using a method that returns the request result directly
      const result = await (service as any).request('/test');

      expect(result).toEqual({});
    });

    it('should throw ApiError for HTTP error with problem details', async () => {
      const mockJsonFn = vi.fn().mockResolvedValue(mockErrorDetails);
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: mockJsonFn,
        })
      );

      try {
        await service.getProjects();
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        const apiError = error as ApiError;
        expect(apiError).toBeInstanceOf(ApiError);
        expect(apiError.message).toBe(mockErrorDetails.detail);
        expect(apiError.status).toBe(400);
        expect(apiError.details).toEqual(mockErrorDetails);
      }
    });

    it('should throw ApiError for HTTP error without problem details', async () => {
      const mockJsonFn = vi.fn().mockRejectedValue(new Error('Invalid JSON'));
      mockFetch.mockResolvedValue(
        createMockResponse({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: mockJsonFn,
        })
      );

      try {
        await service.getProjects();
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        const apiError = error as ApiError;
        expect(apiError).toBeInstanceOf(ApiError);
        expect(apiError.message).toBe('HTTP 500: Internal Server Error');
        expect(apiError.status).toBe(500);
        expect(apiError.details).toBeUndefined();
      }
    });

    it('should throw ApiError for network errors', async () => {
      const networkError = new Error('Network connection failed');
      mockFetch.mockRejectedValue(networkError);

      try {
        await service.getProjects();
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        const apiError = error as ApiError;
        expect(apiError).toBeInstanceOf(ApiError);
        expect(apiError.message).toBe('Network error: Network connection failed');
        expect(apiError.status).toBe(0);
      }
    });

    it('should throw ApiError for unknown errors', async () => {
      mockFetch.mockRejectedValue('Unknown error');

      try {
        await service.getProjects();
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        const apiError = error as ApiError;
        expect(apiError).toBeInstanceOf(ApiError);
        expect(apiError.message).toBe('Network error: Unknown error');
        expect(apiError.status).toBe(0);
      }
    });

    it('should re-throw ApiError instances', async () => {
      const apiError = new ApiError('Custom API error', 400);
      mockFetch.mockImplementationOnce(() => {
        throw apiError;
      });

      await expect(service.getProjects()).rejects.toBe(apiError);
    });
  });

  describe('project endpoints', () => {
    it('should get all projects', async () => {
      const mockProjects = [mockProject];
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockProjects),
        })
      );

      const result = await service.getProjects();

      expect(result).toEqual(mockProjects);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects',
        expect.any(Object)
      );
    });

    it('should get single project', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockProject),
        })
      );

      const result = await service.getProject('project-1');

      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1',
        expect.any(Object)
      );
    });

    it('should create new project', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 201,
          json: vi.fn().mockResolvedValue(mockProject),
        })
      );

      const result = await service.createProject('Test Project');

      expect(result).toEqual(mockProject);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test Project' }),
        })
      );
    });

    it('should delete project', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 204,
          headers: { 'content-length': '0' },
        })
      );

      await service.deleteProject('project-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('fragment endpoints', () => {
    it('should get all fragments for project', async () => {
      const mockFragments = [mockFragment];
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockFragments),
        })
      );

      const result = await service.getFragments('project-1');

      expect(result).toEqual(mockFragments);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/fragments',
        expect.any(Object)
      );
    });

    it('should get single fragment', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockFragment),
        })
      );

      const result = await service.getFragment('project-1', 'fragment-1');

      expect(result).toEqual(mockFragment);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/fragments/fragment-1',
        expect.any(Object)
      );
    });

    it('should create new fragment', async () => {
      const request: CreateFragmentRequest = {
        path: 'test.cue',
        content: 'package test\n\nfoo: "bar"',
      };
      const mockResponse = { fragment: mockFragment };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 201,
          json: vi.fn().mockResolvedValue(mockResponse),
        })
      );

      const result = await service.createFragment('project-1', request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/fragments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });

    it('should update fragment', async () => {
      const updatedContent = 'package test\n\nupdated: "value"';
      const updatedFragment = { ...mockFragment, content: updatedContent };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(updatedFragment),
        })
      );

      const result = await service.updateFragment('project-1', 'fragment-1', updatedContent);

      expect(result).toEqual(updatedFragment);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/fragments/fragment-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ content: updatedContent }),
        })
      );
    });

    it('should delete fragment', async () => {
      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 204,
          headers: { 'content-length': '0' },
        })
      );

      await service.deleteFragment('project-1', 'fragment-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/fragments/fragment-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('validation endpoints', () => {
    it('should validate project with default request', async () => {
      const mockValidation = {
        valid: true,
        errors: [],
        warnings: [],
        spec_hash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockValidation),
        })
      );

      const result = await service.validateProject('project-1');

      expect(result).toEqual(mockValidation);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('should validate project with custom request', async () => {
      const request: ValidationRequest = {};
      const mockValidation = {
        valid: false,
        errors: [{ message: 'Test error', location: 'test.cue:1' }],
        warnings: [],
        spec_hash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockValidation),
        })
      );

      const result = await service.validateProject('project-1', request);

      expect(result).toEqual(mockValidation);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/validate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });
  });

  describe('resolved spec endpoints', () => {
    it('should get resolved spec', async () => {
      const mockResolved = {
        resolved: { test: 'value' },
        spec_hash: 'abc123',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockResolved),
        })
      );

      const result = await service.getResolvedSpec('project-1');

      expect(result).toEqual(mockResolved);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/resolved',
        expect.any(Object)
      );
    });
  });

  describe('gap analysis endpoints', () => {
    it('should get gaps', async () => {
      const mockGaps = {
        missing_capabilities: [],
        orphaned_tokens: [],
        coverage_gaps: [],
        duplicates: [],
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockGaps),
        })
      );

      const result = await service.getGaps('project-1');

      expect(result).toEqual(mockGaps);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/gaps',
        expect.any(Object)
      );
    });
  });

  describe('IR endpoints', () => {
    it('should get single IR', async () => {
      const mockIR = {
        kind: 'capabilities' as IRKind,
        data: { test: 'ir-data' },
        generated_at: '2023-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockIR),
        })
      );

      const result = await service.getIR('project-1', 'capabilities' as IRKind);

      expect(result).toEqual(mockIR);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/ir/capabilities',
        expect.any(Object)
      );
    });

    it('should get all IRs successfully', async () => {
      const mockIRs = {
        capabilities: { kind: 'capabilities', data: {}, generated_at: '2023-01-01T00:00:00Z' },
        flows: { kind: 'flows', data: {}, generated_at: '2023-01-01T00:00:00Z' },
        dependencies: { kind: 'dependencies', data: {}, generated_at: '2023-01-01T00:00:00Z' },
        coverage: { kind: 'coverage', data: {}, generated_at: '2023-01-01T00:00:00Z' },
      };

      // Mock successful responses for all IR kinds with proper headers
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(mockIRs.capabilities),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(mockIRs.flows),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(mockIRs.dependencies),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(mockIRs.coverage),
          })
        );

      const result = await service.getAllIRs('project-1');

      expect(result).toEqual(mockIRs);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle partial failures when getting all IRs', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mockCapabilities = {
        kind: 'capabilities',
        data: {},
        generated_at: '2023-01-01T00:00:00Z',
      };

      // Mock mixed success/failure responses
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(mockCapabilities),
          })
        )
        .mockRejectedValueOnce(new Error('Failed to load flows'))
        .mockResolvedValueOnce(
          createMockResponse({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            json: vi.fn().mockResolvedValue({ detail: 'Dependencies not found' }),
          })
        )
        .mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({
              kind: 'coverage',
              data: {},
              generated_at: '2023-01-01T00:00:00Z',
            }),
          })
        );

      const result = await service.getAllIRs('project-1');

      expect(result).toEqual({
        capabilities: mockCapabilities,
        coverage: { kind: 'coverage', data: {}, generated_at: '2023-01-01T00:00:00Z' },
      });
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });
  });

  describe('version freezing endpoints', () => {
    it('should freeze version', async () => {
      const request: FreezeRequest = {
        version_name: '1.0.0',
        description: 'Initial release',
      };
      const mockResponse = {
        version: '1.0.0',
        spec_hash: 'abc123',
        frozen_at: '2023-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 201,
          json: vi.fn().mockResolvedValue(mockResponse),
        })
      );

      const result = await service.freezeVersion('project-1', request);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/projects/project-1/freeze',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });
  });

  describe('health check endpoint', () => {
    it('should perform health check', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2023-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce(
        createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockHealth),
        })
      );

      const result = await service.healthCheck();

      expect(result).toEqual(mockHealth);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/health',
        expect.any(Object)
      );
    });
  });

  describe('edge cases and comprehensive coverage', () => {
    describe('authentication flow', () => {
      it('should handle authentication token changes during requests', async () => {
        // Set initial token
        service.setAuthToken('token-1');

        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([]),
          })
        );

        await service.getProjects();

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer token-1',
            }),
          })
        );

        // Change token and make another request
        service.setAuthToken('token-2');

        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue([]),
          })
        );

        await service.getProjects();

        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer token-2',
            }),
          })
        );
      });

      it('should handle custom headers in individual requests', async () => {
        service.setAuthToken('test-token');

        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 201,
            json: vi.fn().mockResolvedValue(mockProject),
          })
        );

        await service.createProject('Test Project');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    describe('error handling edge cases', () => {
      it('should handle malformed error details JSON', async () => {
        const mockJsonFn = vi.fn().mockResolvedValue({ malformed: 'not valid problem details' });
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 422,
            statusText: 'Unprocessable Entity',
            json: mockJsonFn,
          })
        );

        try {
          await service.getProjects();
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          const apiError = error as ApiError;
          expect(apiError).toBeInstanceOf(ApiError);
          expect(apiError.status).toBe(422);
          expect(apiError.message).toBe('HTTP 422: Unprocessable Entity');
          expect(apiError.details).toEqual({ malformed: 'not valid problem details' });
        }
      });

      it('should handle empty error response body', async () => {
        const mockJsonFn = vi.fn().mockResolvedValue({});
        mockFetch.mockResolvedValue(
          createMockResponse({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            json: mockJsonFn,
          })
        );

        try {
          await service.getProjects();
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          const apiError = error as ApiError;
          expect(apiError).toBeInstanceOf(ApiError);
          expect(apiError.status).toBe(503);
          expect(apiError.message).toBe('HTTP 503: Service Unavailable');
          expect(apiError.details).toEqual({});
        }
      });

      it('should handle fetch throwing TypeError (network issues)', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        try {
          await service.getProjects();
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          const apiError = error as ApiError;
          expect(apiError).toBeInstanceOf(ApiError);
          expect(apiError.status).toBe(0);
          expect(apiError.message).toBe('Network error: Failed to fetch');
        }
      });

      it('should handle non-Error objects being thrown', async () => {
        mockFetch.mockRejectedValue({ message: 'Custom error object' });

        try {
          await service.getProjects();
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          const apiError = error as ApiError;
          expect(apiError).toBeInstanceOf(ApiError);
          expect(apiError.status).toBe(0);
          expect(apiError.message).toBe('Network error: Unknown error');
        }
      });
    });

    describe('response parsing edge cases', () => {
      it('should handle responses with zero content-length header', async () => {
        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            headers: { 'content-length': '0' },
          })
        );

        const result = await (service as any).request('/test');
        expect(result).toEqual({});
      });

      it('should handle successful responses with valid JSON', async () => {
        const testData = { test: 'data', nested: { value: 123 } };
        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue(testData),
          })
        );

        const result = await (service as any).request('/test');
        expect(result).toEqual(testData);
      });

      it('should handle responses that fail JSON parsing', async () => {
        const mockJsonFn = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'));
        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: mockJsonFn,
          })
        );

        try {
          await (service as any).request('/test');
          expect.fail('Should have thrown an error');
        } catch (error: unknown) {
          const apiError = error as ApiError;
          expect(apiError).toBeInstanceOf(ApiError);
          expect(apiError.status).toBe(0);
          expect(apiError.message).toBe('Network error: Unexpected token');
        }
      });
    });

    describe('concurrent request handling', () => {
      it('should handle multiple simultaneous requests', async () => {
        const mockProject1 = { ...mockProject, id: 'project-1', name: 'Project 1' };
        const mockProject2 = { ...mockProject, id: 'project-2', name: 'Project 2' };

        mockFetch
          .mockResolvedValueOnce(
            createMockResponse({
              ok: true,
              status: 200,
              json: vi.fn().mockResolvedValue(mockProject1),
            })
          )
          .mockResolvedValueOnce(
            createMockResponse({
              ok: true,
              status: 200,
              json: vi.fn().mockResolvedValue(mockProject2),
            })
          );

        const [result1, result2] = await Promise.all([
          service.getProject('project-1'),
          service.getProject('project-2'),
        ]);

        expect(result1).toEqual(mockProject1);
        expect(result2).toEqual(mockProject2);
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      it('should handle mixed success and failure requests', async () => {
        const successResponse = createMockResponse({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue(mockProject),
        });

        const errorResponse = createMockResponse({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: vi.fn().mockResolvedValue({ detail: 'Project not found' }),
        });

        mockFetch.mockResolvedValueOnce(successResponse).mockResolvedValueOnce(errorResponse);

        const results = await Promise.allSettled([
          service.getProject('existing-project'),
          service.getProject('non-existent-project'),
        ]);

        expect(results[0].status).toBe('fulfilled');
        expect(results[1].status).toBe('rejected');
        expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
      });
    });

    describe('request configuration edge cases', () => {
      it('should properly merge custom headers with default headers', async () => {
        service.setAuthToken('test-token');

        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({}),
          })
        );

        // Test with custom headers that should merge with defaults
        await (service as any).request('/test', {
          headers: {
            'X-Custom-Header': 'custom-value',
            'Content-Type': 'application/custom', // Should override default
          },
        });

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/custom', // Overridden
              Authorization: 'Bearer test-token', // From defaults
              'X-Custom-Header': 'custom-value', // Custom
            },
          })
        );
      });

      it('should handle requests with different HTTP methods and bodies', async () => {
        const requestBody = { data: 'test' };

        mockFetch.mockResolvedValueOnce(
          createMockResponse({
            ok: true,
            status: 201,
            json: vi.fn().mockResolvedValue({ created: true }),
          })
        );

        await (service as any).request('/test', {
          method: 'PATCH',
          body: JSON.stringify(requestBody),
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:4000/api/test',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify(requestBody),
          })
        );
      });
    });
  });
});

describe('apiService singleton', () => {
  it('should export a singleton instance', () => {
    expect(apiService).toBeInstanceOf(ApiService);
  });

  it('should maintain state across calls', () => {
    apiService.setAuthToken('test-token');

    // Mock a request to verify token is used
    mockFetch.mockResolvedValueOnce(
      createMockResponse({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      })
    );

    apiService.healthCheck();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });
});
