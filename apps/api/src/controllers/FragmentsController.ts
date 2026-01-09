import { randomUUID } from "node:crypto";
import path from "node:path";
import { logger } from "../io/utils";
import type { SpecWorkbenchDB } from "../util/db";
import type { SpecEngine } from "../util/specEngine";

type Dependencies = Record<string, unknown>;

function normalizePath(fragmentPath: string): string {
  const normalized = path
    .normalize(fragmentPath)
    .replace(/\\/g, "/")
    .replace(/^(\.\/)+/, "")
    .replace(/^\//, "");

  return normalized.length > 0 ? normalized : "assembly.cue";
}

export class FragmentsController {
  private db: SpecWorkbenchDB;
  private specEngine?: SpecEngine;

  constructor(deps: Dependencies) {
    this.db = deps.db as SpecWorkbenchDB;
    this.specEngine = deps.specEngine as SpecEngine | undefined;
  }

  async list(projectId: string) {
    return this.db.listFragments(projectId);
  }

  private async ensureProjectExists(projectId: string): Promise<void> {
    const existingProject = await this.db.getProject(projectId);
    if (!existingProject) {
      await this.db.createProject(projectId, projectId);
    }
  }

  private async upsertFragment(
    projectId: string,
    fragmentPath: string,
    content: string,
    author?: string,
    message?: string,
  ) {
    const existingFragment = await this.db.getFragment(projectId, fragmentPath);
    if (existingFragment !== null) {
      return this.db.updateFragment(projectId, fragmentPath, content, author, message);
    }
    return this.db.createFragment(
      randomUUID(),
      projectId,
      fragmentPath,
      content,
      author,
      message ?? "Initial fragment import",
    );
  }

  private async validateFragments(projectId: string) {
    if (!this.specEngine) return undefined;

    try {
      const projectFragments = await this.db.listFragments(projectId);
      const result = await this.specEngine.validateProject(projectId, projectFragments);

      if (result.success && result.resolved) {
        await this.persistResolvedSpec(projectId, result.specHash, result.resolved);
      }

      return {
        success: result.success,
        specHash: result.specHash,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error) {
      logger.warn("Fragment validation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  async create(payload: {
    projectId: string;
    path: string;
    content: string;
    author?: string;
    message?: string;
  }) {
    const projectId = payload.projectId.trim();
    const fragmentPath = normalizePath(payload.path);

    await this.ensureProjectExists(projectId);
    const fragment = await this.upsertFragment(
      projectId,
      fragmentPath,
      payload.content,
      payload.author,
      payload.message,
    );
    const validation = await this.validateFragments(projectId);

    return { fragment, validation };
  }

  private async persistResolvedSpec(
    projectId: string,
    specHash: string,
    resolved: Record<string, unknown>,
  ) {
    const resolvedJson = JSON.stringify(resolved, null, 2);

    const latestVersion = await this.db.getLatestVersion(projectId);
    if (latestVersion && latestVersion.spec_hash === specHash) {
      return;
    }

    await this.db.createVersion(`version-${Date.now()}`, projectId, specHash, resolvedJson);
  }
}
