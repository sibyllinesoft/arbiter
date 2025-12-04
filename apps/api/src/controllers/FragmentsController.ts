import { randomUUID } from "node:crypto";
import path from "node:path";
import type { SpecWorkbenchDB } from "../db";
import type { SpecEngine } from "../specEngine";
import { logger } from "../utils";

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

  async create(payload: {
    projectId: string;
    path: string;
    content: string;
    author?: string;
    message?: string;
  }) {
    const projectId = payload.projectId.trim();
    const fragmentPath = normalizePath(payload.path);
    const content = payload.content;

    // Ensure project row exists
    const existingProject = await this.db.getProject(projectId);
    if (!existingProject) {
      await this.db.createProject(projectId, projectId);
    }

    const existingFragment = await this.db.getFragment(projectId, fragmentPath);
    const fragment =
      existingFragment !== null
        ? await this.db.updateFragment(
            projectId,
            fragmentPath,
            content,
            payload.author,
            payload.message,
          )
        : await this.db.createFragment(
            randomUUID(),
            projectId,
            fragmentPath,
            content,
            payload.author,
            payload.message ?? "Initial fragment import",
          );

    let validation:
      | {
          success: boolean;
          specHash: string;
          errors: unknown[];
          warnings: unknown[];
        }
      | undefined;

    if (this.specEngine) {
      try {
        const projectFragments = await this.db.listFragments(projectId);
        const validationResult = await this.specEngine.validateProject(projectId, projectFragments);
        validation = {
          success: validationResult.success,
          specHash: validationResult.specHash,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        };

        if (validationResult.success && validationResult.resolved) {
          await this.persistResolvedSpec(
            projectId,
            validationResult.specHash,
            validationResult.resolved,
          );
        }
      } catch (error) {
        logger.warn("Fragment validation failed", error instanceof Error ? error : undefined);
      }
    }

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
