/**
 * @packageDocumentation
 * System repository for server-level operations.
 *
 * Provides operations for health checks, validation, exports, and component discovery.
 */

import { ApiClient } from "@/io/api/api-client.js";
import type { CommandResult } from "@/types.js";
import type { ValidationResponse } from "@arbiter/shared";

/**
 * SystemRepository encapsulates server-level operations (health, exports, discovery endpoints)
 * keeping ApiClient focused on transport concerns.
 */
export class SystemRepository {
  /**
   * Create a new SystemRepository.
   * @param client - API client for making requests
   */
  constructor(private readonly client: ApiClient) {}

  /**
   * Check server health status.
   * @returns Promise resolving to command result with health status
   */
  async health(): Promise<CommandResult<{ status: string; timestamp: string }>> {
    return this.client.health();
  }

  /**
   * Validate CUE specification content.
   * @param content - CUE content to validate
   * @param options - Validation options
   * @returns Promise resolving to command result with validation response
   */
  async validate(
    content: string,
    options: {
      schema?: string;
      strict?: boolean;
    } = {},
  ): Promise<CommandResult<ValidationResponse>> {
    return this.client.validate(content, options);
  }

  /**
   * Export specification to a target format.
   * @param content - CUE content to export
   * @param format - Target export format
   * @param options - Export options
   * @returns Promise resolving to command result with export data
   */
  async export(
    content: string,
    format: string,
    options: {
      strict?: boolean;
      includeExamples?: boolean;
      outputMode?: "single" | "multiple";
    } = {},
  ): Promise<CommandResult<any>> {
    return this.client.export(content, format, options);
  }

  /**
   * Get list of supported export formats.
   * @returns Promise resolving to command result with format list
   */
  async getSupportedFormats(): Promise<CommandResult<any>> {
    return this.client.getSupportedFormats();
  }

  /**
   * List available components.
   * @param type - Optional component type filter
   * @returns Promise resolving to command result with component list
   */
  async listComponents(type?: string): Promise<CommandResult<any[]>> {
    return this.client.listComponents(type);
  }
}
