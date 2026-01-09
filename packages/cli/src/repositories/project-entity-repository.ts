/**
 * @packageDocumentation
 * Project entity repository for managing project artifacts.
 *
 * Provides CRUD operations for project entities via the API.
 */

import { ApiClient } from "@/io/api/api-client.js";
import type { CommandResult } from "@/types.js";

/**
 * Repository for managing project entities (artifacts).
 */
export class ProjectEntityRepository {
  /**
   * Create a new ProjectEntityRepository.
   * @param client - API client for making requests
   */
  constructor(private readonly client: ApiClient) {}

  /**
   * Create a new entity in a project.
   * @param projectId - Project identifier
   * @param payload - Entity type and values
   * @returns Promise resolving to command result with created entity
   */
  async create(
    projectId: string,
    payload: { type: string; values: Record<string, unknown> },
  ): Promise<CommandResult<any>> {
    return this.client.post(`/api/projects/${projectId}/entities`, payload);
  }

  /**
   * Update an existing entity in a project.
   * @param projectId - Project identifier
   * @param artifactId - Entity artifact identifier
   * @param payload - Entity type and updated values
   * @returns Promise resolving to command result with updated entity
   */
  async update(
    projectId: string,
    artifactId: string,
    payload: { type: string; values: Record<string, unknown> },
  ): Promise<CommandResult<any>> {
    return this.client.put(`/api/projects/${projectId}/entities/${artifactId}`, payload);
  }

  /**
   * Delete an entity from a project.
   * @param projectId - Project identifier
   * @param artifactId - Entity artifact identifier
   * @returns Promise resolving to command result
   */
  async delete(projectId: string, artifactId: string): Promise<CommandResult<any>> {
    return this.client.delete(`/api/projects/${projectId}/entities/${artifactId}`);
  }
}
