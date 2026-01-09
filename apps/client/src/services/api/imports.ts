import { ApiClient } from "./client";

export class ImportService {
  private readonly client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  // provide explicit method typings to satisfy erasableSyntaxOnly

  async scanGitUrl(gitUrl: string): Promise<{
    success: boolean;
    tempPath?: string;
    files?: string[];
    projectStructure?: {
      hasPackageJson: boolean;
      hasCargoToml: boolean;
      hasDockerfile: boolean;
      hasCueFiles: boolean;
      hasYamlFiles: boolean;
      hasJsonFiles: boolean;
      importableFiles: string[];
    };
    gitUrl?: string;
    projectName?: string;
    error?: string;
  }> {
    return this.client.request("/api/import/scan-git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gitUrl }),
    });
  }

  async scanLocalPath(directoryPath: string): Promise<{
    success: boolean;
    path?: string;
    files?: string[];
    projectStructure?: {
      hasPackageJson: boolean;
      hasCargoToml: boolean;
      hasDockerfile: boolean;
      hasCueFiles: boolean;
      hasYamlFiles: boolean;
      hasJsonFiles: boolean;
      importableFiles: string[];
    };
    error?: string;
  }> {
    return this.client.request("/api/import/scan-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directoryPath }),
    });
  }

  async cleanupImport(tempId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.client.request(`/api/import/cleanup/${tempId}`, {
      method: "DELETE",
    });
  }
}
