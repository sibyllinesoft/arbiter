/**
 * @packageDocumentation
 * Project repository for project configuration and metadata.
 *
 * Provides operations for fetching project-level data via the API.
 */

import { ApiClient, type ProjectStructureApiResponse } from "@/io/api/api-client.js";

/**
 * Repository responsible for project-level configuration and metadata.
 * Keeps business logic out of the low-level ApiClient transport.
 */
function makeErrorResponse(message: string): ProjectStructureApiResponse {
  return { success: false, error: message };
}

async function extractApiError(response: Response): Promise<ProjectStructureApiResponse> {
  const errorText = await response.text();
  return makeErrorResponse(`API error: ${response.status} ${errorText}`);
}

export class ProjectRepository {
  /**
   * Create a new ProjectRepository.
   * @param client - API client for making requests
   */
  constructor(private readonly client: ApiClient) {}

  /**
   * Fetch the project structure configuration.
   * @returns Promise resolving to project structure response
   */
  async fetchProjectStructure(): Promise<ProjectStructureApiResponse> {
    try {
      const response = await this.client.request("/api/config/project-structure");
      if (!response.ok) {
        return extractApiError(response);
      }

      const data = (await response.json()) as ProjectStructureApiResponse;
      if (!data.projectStructure) {
        return makeErrorResponse("Server response did not include projectStructure data");
      }

      return {
        success: Boolean(data.success),
        projectStructure: data.projectStructure,
      };
    } catch (error) {
      return makeErrorResponse(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
