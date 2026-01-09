/**
 * @module ProjectService
 * API service for project and event operations.
 * Handles project CRUD, event management, and event revision history.
 */
import type { Event, Project } from "@/types/api";
import { ApiClient } from "./client";

/** Response from fetching project events */
export interface ProjectEventsResponse {
  success: boolean;
  events: Event[];
  head_event: Event | null;
  head_event_id: string | null;
  dangling_event_ids: string[];
}

export interface SetEventHeadResponse {
  success: boolean;
  head_event: Event | null;
  head_event_id: string | null;
  reactivated_event_ids: string[];
  deactivated_event_ids: string[];
}

export interface RevertEventsResponse {
  success: boolean;
  head_event: Event | null;
  head_event_id: string | null;
  reverted_event_ids: string[];
}

export class ProjectService {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.client.request<{ projects: Project[] }>("/api/projects");
    return response.projects;
  }

  async getProject(projectId: string): Promise<Project> {
    return this.client.request<Project>(`/api/projects/${projectId}`);
  }

  async getProjectEvents(
    projectId: string,
    options: { limit?: number; includeDangling?: boolean; since?: string } = {},
  ): Promise<ProjectEventsResponse> {
    const params = new URLSearchParams();

    if (options.limit) {
      params.set("limit", String(options.limit));
    }

    if (options.since) {
      params.set("since", options.since);
    }

    if (options.includeDangling === false) {
      params.set("includeDangling", "false");
    }

    const queryString = params.toString() ? `?${params.toString()}` : "";

    return this.client.request<ProjectEventsResponse>(
      `/api/projects/${projectId}/events${queryString}`,
    );
  }

  async setProjectEventHead(
    projectId: string,
    headEventId: string | null,
  ): Promise<SetEventHeadResponse> {
    return this.client.request<SetEventHeadResponse>(`/api/projects/${projectId}/events/head`, {
      method: "POST",
      body: JSON.stringify({ head_event_id: headEventId }),
    });
  }

  async revertProjectEvents(projectId: string, eventIds: string[]): Promise<RevertEventsResponse> {
    return this.client.request<RevertEventsResponse>(`/api/projects/${projectId}/events/revert`, {
      method: "POST",
      body: JSON.stringify({ event_ids: eventIds }),
    });
  }

  async createProject(name: string, path?: string, presetId?: string): Promise<Project> {
    return this.client.request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(
        Object.fromEntries(
          Object.entries({ name, path, presetId }).filter(([, value]) => value !== undefined),
        ),
      ),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.client.request<void>(`/api/projects/${projectId}`, {
      method: "DELETE",
    });
  }

  async createProjectEntity(
    projectId: string,
    payload: { type: string; values: Record<string, unknown> },
  ) {
    const normalizedValues = this.normalizeEntityValues(payload.values);

    return this.client.request(`/api/projects/${projectId}/entities`, {
      method: "POST",
      body: JSON.stringify({
        type: payload.type,
        values: normalizedValues,
      }),
    });
  }

  async updateProjectEntity(
    projectId: string,
    artifactId: string,
    payload: { type: string; values: Record<string, unknown> },
  ) {
    if (!artifactId) {
      throw new Error("artifactId is required to update a project entity");
    }

    const normalizedValues = this.normalizeEntityValues(payload.values);

    return this.client.request(`/api/projects/${projectId}/entities/${artifactId}`, {
      method: "PUT",
      body: JSON.stringify({
        type: payload.type,
        values: normalizedValues,
      }),
    });
  }

  async deleteProjectEntity(projectId: string, artifactId: string): Promise<void> {
    if (!artifactId) {
      throw new Error("artifactId is required to delete a project entity");
    }
    await this.client.request<void>(`/api/projects/${projectId}/entities/${artifactId}`, {
      method: "DELETE",
    });
  }

  async restoreProjectEntity(
    projectId: string,
    artifactId: string,
    payload: { snapshot: Record<string, unknown>; eventId?: string | null },
  ): Promise<void> {
    if (!artifactId) {
      throw new Error("artifactId is required to restore a project entity");
    }
    if (!payload?.snapshot || typeof payload.snapshot !== "object") {
      throw new Error("snapshot is required to restore a project entity");
    }
    await this.client.request<void>(`/api/projects/${projectId}/entities/${artifactId}/restore`, {
      method: "POST",
      body: JSON.stringify({
        snapshot: payload.snapshot,
        eventId: payload.eventId ?? undefined,
      }),
    });
  }

  /** Normalize a single entity value */
  private normalizeValue(value: unknown): unknown {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return typeof value === "string" ? value : String(value ?? "");
  }

  private normalizeEntityValues(values: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, this.normalizeValue(value)]),
    );
  }
}
