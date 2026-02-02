/**
 * @packageDocumentation
 * Specification repository for CUE specification storage and retrieval.
 *
 * Provides operations for storing, retrieving, and processing specifications.
 */

import type { ApiClient } from "@/io/api/api-client.js";
import type { CommandResult } from "@/types.js";
import type { IRResponse } from "@arbiter/specification";

/** Parameters for storing a specification. */
type StoreSpecParams = {
  content: string;
  type: string;
  path: string;
  shard?: string;
};

/**
 * Repository responsible for specification persistence and IR retrieval.
 * Keeps transport details inside ApiClient while isolating domain-specific calls.
 */
export class SpecificationRepository {
  /**
   * Create a new SpecificationRepository.
   * @param client - API client for making requests
   */
  constructor(private readonly client: ApiClient) {}

  /**
   * Store a specification in the backend.
   * @param spec - Specification parameters
   * @returns Promise resolving to command result with stored spec data
   */
  async storeSpecification(
    spec: StoreSpecParams,
  ): Promise<CommandResult<{ success: boolean; id: string; shard?: string }>> {
    this.client.validatePayloadSize(spec.content);
    this.client.validatePayloadSize(JSON.stringify({ ...spec, sharded: true }));

    const response = await this.client.request("/api/specifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...spec, sharded: true }),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        data: null,
        error: `Failed to store specification: ${error}`,
        exitCode: 1,
      };
    }

    const data = await response.json();
    return { success: true, data, error: null, exitCode: 0 };
  }

  /**
   * Retrieve a stored specification.
   * @param type - Specification type
   * @param path - Specification path
   * @returns Promise resolving to command result with specification content
   */
  async getSpecification(type: string, path: string): Promise<CommandResult<{ content: string }>> {
    const params = new URLSearchParams({ type, path });
    const response = await this.client.request(`/api/specifications?${params}`);

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, data: null, error: "Specification not found", exitCode: 1 };
      }
      const error = await response.text();
      return {
        success: false,
        data: null,
        error: `Failed to get specification: ${error}`,
        exitCode: 1,
      };
    }

    const data = await response.json();
    return { success: true, data, error: null, exitCode: 0 };
  }

  /**
   * Get intermediate representation (IR) for specification content.
   * @param content - CUE specification content
   * @returns Promise resolving to command result with IR response
   */
  async getIR(content: string): Promise<CommandResult<IRResponse>> {
    this.client.validatePayloadSize(content);
    this.client.validatePayloadSize(JSON.stringify({ text: content }));

    const response = await this.client.request("/api/ir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: content }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `API error: ${response.status} ${errorText}`,
        exitCode: 1,
      };
    }

    const data: IRResponse = await response.json();
    return { success: true, data, exitCode: 0 };
  }
}
