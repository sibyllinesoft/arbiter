/**
 * @module SpecService
 * API service for specification operations.
 * Handles spec resolution, validation, IR generation, and freezing.
 */
import type {
  FreezeRequest,
  FreezeResponse,
  IRKind,
  IRResponse,
  ResolvedSpecResponse,
  ValidationRequest,
  ValidationResponse,
} from "@/types/api";
import { createLogger } from "@/utils/logger";
import { ApiClient } from "./client";

const log = createLogger("SpecService");

/**
 * Service class for specification operations.
 * Provides methods for resolving, validating, and generating IR from specs.
 */
export class SpecService {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async validateProject(
    projectId: string,
    request: ValidationRequest = {},
  ): Promise<ValidationResponse> {
    return this.client.request<ValidationResponse>("/api/validate", {
      method: "POST",
      body: JSON.stringify({ projectId, ...request }),
    });
  }

  async getResolvedSpec(projectId: string): Promise<ResolvedSpecResponse> {
    const response = await this.client.request<{
      success: boolean;
      projectId: string;
      resolved: Record<string, unknown>;
    }>(`/api/resolved?projectId=${projectId}`);

    return {
      spec_hash: "generated",
      resolved: response.resolved,
      last_updated: new Date().toISOString(),
    };
  }

  async getIR(projectId: string, kind: IRKind): Promise<IRResponse> {
    if (!kind) {
      throw new Error("IRKind is required");
    }
    return this.client.request<IRResponse>(`/api/ir/${kind}?projectId=${projectId}`);
  }

  async getAllIRs(projectId: string): Promise<Record<IRKind, IRResponse>> {
    const kinds: IRKind[] = ["flow", "fsm", "view", "site"];
    const irs: Record<IRKind, IRResponse> = {} as Record<IRKind, IRResponse>;

    for (const kind of kinds) {
      try {
        const ir = await this.getIR(projectId, kind);
        irs[kind] = ir;
      } catch (error) {
        log.warn(`Failed to load IR for ${kind}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return irs;
  }

  async freezeVersion(projectId: string, request: FreezeRequest): Promise<FreezeResponse> {
    return this.client.request<FreezeResponse>("/api/freeze", {
      method: "POST",
      body: JSON.stringify({ projectId, ...request }),
    });
  }
}
