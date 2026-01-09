import path from "node:path";
import type { ApiClient } from "@/io/api/api-client.js";
import type { CLIConfig } from "@/types.js";

/**
 * Check if project with given ID exists in the project list.
 */
function findExistingProject(
  listResult: { success: boolean; data?: any[] },
  desiredId: string,
): boolean {
  if (!listResult.success || !Array.isArray(listResult.data)) {
    return false;
  }
  return listResult.data.some(
    (project: any) => typeof project?.id === "string" && project.id === desiredId,
  );
}

/**
 * Create a new project on the service.
 */
async function createNewProject(
  client: ApiClient,
  config: CLIConfig,
  desiredId: string,
): Promise<string> {
  const projectName = deriveProjectName(config);
  const projectPath = config.projectDir || process.cwd();
  const createResult = await client.createProject({
    id: desiredId,
    name: projectName,
    path: projectPath,
  });

  if (!createResult.success) {
    throw new Error(createResult.error || "Failed to create project in service");
  }

  return createResult.data?.id || desiredId;
}

/**
 * Ensure a project exists on the Arbiter service, creating it if needed.
 *
 * @param client - API client instance.
 * @param config - CLI configuration context.
 * @param explicitProjectId - Optional project identifier override.
 * @returns The identifier of the ensured project.
 */
export async function ensureProjectExists(
  client: ApiClient,
  config: CLIConfig,
  explicitProjectId?: string,
): Promise<string> {
  const desiredId = explicitProjectId || config.projectId || "cli-project";
  const listResult = await client.listProjects();

  if (findExistingProject(listResult, desiredId)) {
    return desiredId;
  }

  return createNewProject(client, config, desiredId);
}

/**
 * Derive a human-readable project name from the configured project directory.
 *
 * @param config - CLI configuration context.
 * @returns A project name suitable for service registration.
 */
export function deriveProjectName(config: CLIConfig): string {
  const root = config.projectDir || process.cwd();
  const base = path.basename(root);
  return base && base.trim().length > 0 ? base : "arbiter-project";
}
