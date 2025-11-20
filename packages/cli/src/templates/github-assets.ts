import type { TemplateOrchestrator } from "./index.js";
import { templateOrchestrator } from "./index.js";

export interface GitHubTemplateAssetOptions {
  overrideDirectories?: string[];
  defaultDirectories?: string[];
}

export class GitHubTemplateAssetStrategy {
  constructor(private readonly orchestrator: TemplateOrchestrator = templateOrchestrator) {}

  async resolve(
    templatePath: string,
    options: GitHubTemplateAssetOptions = {},
  ): Promise<{ content: string; resolvedPath: string } | undefined> {
    return this.orchestrator.resolveTemplateAsset(templatePath, {
      overrideDirectories: options.overrideDirectories,
      defaultDirectories: options.defaultDirectories,
    });
  }
}
