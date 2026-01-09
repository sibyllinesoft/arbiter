import type { UIOptionCatalog } from "@arbiter/shared";
import { ApiClient } from "./client";

export interface EnvironmentInfo {
  runtime: "cloudflare" | "node";
  cloudflareTunnelSupported: boolean;
}

export interface ProjectStructureSettings {
  appsDirectory: string;
  packagesDirectory: string;
  servicesDirectory: string;
  docsDirectory: string;
  testsDirectory: string;
  infraDirectory: string;
  packageRelative?: {
    docsDirectory?: boolean;
    testsDirectory?: boolean;
    infraDirectory?: boolean;
  };
}

export interface ProjectStructureResponse {
  success: boolean;
  projectStructure: ProjectStructureSettings;
}

interface UiOptionsResponse {
  success: boolean;
  options?: UIOptionCatalog;
  diagnostics?: string[];
}

export class SystemService {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return this.client.request<EnvironmentInfo>("/api/environment");
  }

  async getProjectStructureSettings(): Promise<ProjectStructureResponse> {
    return this.client.request<ProjectStructureResponse>("/api/config/project-structure");
  }

  async updateProjectStructureSettings(
    settings: Partial<ProjectStructureSettings>,
  ): Promise<ProjectStructureResponse> {
    return this.client.request<ProjectStructureResponse>("/api/config/project-structure", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  async getUiOptionCatalog(): Promise<UIOptionCatalog> {
    const response = await this.client.request<UiOptionsResponse>("/api/config/ui-options");
    return (response.options ?? {}) as UIOptionCatalog;
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.client.request<{ status: string; timestamp: string }>("/health");
  }
}
