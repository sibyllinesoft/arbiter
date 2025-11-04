/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemDetails, Project } from "../../types/api";
import { ApiError, ApiService } from "../api";

type MockResponseInit = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<any>;
  headers?: Record<string, string>;
};

const originalFetch = global.fetch;

function createMockResponse(init: MockResponseInit = {}) {
  const headerMap = new Map<string, string>();
  Object.entries(init.headers ?? {}).forEach(([key, value]) =>
    headerMap.set(key.toLowerCase(), value),
  );

  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    json: init.json ?? vi.fn().mockResolvedValue(undefined),
  };
}

describe("ApiError", () => {
  it("captures message, status, and optional details", () => {
    const details: ProblemDetails = {
      type: "https://errors.example.com/bad-request",
      title: "Bad Request",
      status: 400,
      detail: "Invalid input",
      instance: "/api/projects",
    };

    const error = new ApiError("Validation failed", 400, details);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("Validation failed");
    expect(error.status).toBe(400);
    expect(error.details).toEqual(details);
  });
});

describe("ApiService", () => {
  let service: ApiService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    service = new ApiService({ baseUrl: "https://api.test" });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("attaches bearer token when auth token is set", async () => {
    const projects: Project[] = [];
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        json: () => Promise.resolve({ projects }),
      }),
    );

    service.setAuthToken("secret-token");
    await service.getProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/projects",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("removes bearer token when cleared", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        json: () =>
          Promise.resolve({
            projects: [],
          }),
      }),
    );

    service.setAuthToken("secret-token");
    service.clearAuthToken();
    await service.getProjects();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/projects",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  it("treats 204 responses as empty objects", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        status: 204,
        headers: { "content-length": "0" },
      }),
    );

    await expect(service.deleteProject("project-123")).resolves.toBeUndefined();
  });

  it("throws ApiError with problem details when backend returns error payload", async () => {
    const problem: ProblemDetails = {
      type: "https://errors.example.com/forbidden",
      title: "Forbidden",
      status: 403,
      detail: "Missing permission",
      instance: "/api/projects/project-1",
    };

    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: () => Promise.resolve(problem),
      }),
    );

    vi.spyOn(service as any, "handleAuthRedirect").mockResolvedValue(undefined);

    await expect(service.getProject("project-1")).rejects.toMatchObject({
      message: "Missing permission",
      status: 403,
      details: problem,
    });
  });

  it("converts network failures into ApiError instances", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await expect(service.getProjects()).rejects.toBeInstanceOf(ApiError);
    await expect(service.getProjects()).rejects.toMatchObject({
      message: "Network error: offline",
      status: 0,
    });
  });

  it("passes request body for POST endpoints", async () => {
    fetchMock.mockResolvedValueOnce(
      createMockResponse({
        json: () =>
          Promise.resolve({
            version: "1.0.0",
            spec_hash: "abc123",
            frozen_at: "2024-01-01T00:00:00Z",
          }),
      }),
    );

    await service.freezeVersion("project-1", {
      version_name: "1.0.0",
      description: "Initial release",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/freeze",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          projectId: "project-1",
          version_name: "1.0.0",
          description: "Initial release",
        }),
      }),
    );
  });
});
