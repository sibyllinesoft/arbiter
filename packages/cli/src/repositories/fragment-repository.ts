/**
 * @packageDocumentation
 * Fragment repository for CUE specification fragments.
 *
 * Provides CRUD operations for managing CUE fragments via the API.
 */

import { ApiClient } from "@/io/api/api-client.js";
import type { CommandResult } from "@/types.js";

/**
 * Build API error result from response
 */
async function buildApiErrorResult<T>(response: Response): Promise<CommandResult<T>> {
  const errorText = await response.text();
  return {
    success: false,
    error: `API error: ${response.status} ${errorText}`,
    exitCode: 1,
  };
}

/**
 * Build network error result from exception
 */
function buildNetworkErrorResult<T>(error: unknown): CommandResult<T> {
  return {
    success: false,
    error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    exitCode: 2,
  };
}

/**
 * Build success result with data
 */
function buildSuccessResult<T>(data: T): CommandResult<T> {
  return {
    success: true,
    data,
    exitCode: 0,
  };
}

/**
 * Repository for managing CUE specification fragments.
 */
export class FragmentRepository {
  constructor(private readonly client: ApiClient) {}

  async list(projectId = "default"): Promise<CommandResult<any[]>> {
    try {
      const response = await this.client.request(
        `/api/fragments?projectId=${encodeURIComponent(projectId)}`,
      );

      if (!response.ok) {
        return buildApiErrorResult(response);
      }

      return buildSuccessResult(await response.json());
    } catch (error) {
      return buildNetworkErrorResult(error);
    }
  }

  async upsert(
    projectId: string,
    path: string,
    content: string,
    options?: { author?: string; message?: string },
  ): Promise<CommandResult<any>> {
    try {
      this.client.validatePayloadSize(content);
      const requestPayload = JSON.stringify({ projectId, path, content, ...options });
      this.client.validatePayloadSize(requestPayload);

      const response = await this.client.request("/api/fragments", {
        method: "POST",
        body: requestPayload,
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return buildApiErrorResult(response);
      }

      return buildSuccessResult(await response.json());
    } catch (error) {
      return buildNetworkErrorResult(error);
    }
  }
}
