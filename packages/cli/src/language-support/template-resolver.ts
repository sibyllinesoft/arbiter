import path from "node:path";
import { TemplateOrchestrator, templateOrchestrator } from "@/templates/index.js";

export interface TemplateResolverOptions {
  language: string;
  overrideDirectories?: string[];
  defaultDirectories?: string[];
  orchestrator?: TemplateOrchestrator;
}

export class TemplateResolver {
  private readonly language: string;
  private overrideDirectories: string[] = [];
  private defaultDirectories: string[] = [];
  private orchestrator: TemplateOrchestrator;

  constructor(options: TemplateResolverOptions) {
    this.language = options.language;
    this.orchestrator = options.orchestrator ?? templateOrchestrator;
    if (options.overrideDirectories) {
      this.setOverrideDirectories(options.overrideDirectories);
    }
    if (options.defaultDirectories) {
      this.setDefaultDirectories(options.defaultDirectories);
    }
  }

  setOverrideDirectories(directories: string[]): void {
    this.overrideDirectories = this.normalizeDirectories(directories);
  }

  setDefaultDirectories(directories: string[]): void {
    this.defaultDirectories = this.normalizeDirectories(directories);
  }

  async renderTemplate(
    templatePath: string,
    context: Record<string, unknown>,
    fallback?: string,
  ): Promise<string> {
    const templateContent = await this.readTemplate(templatePath);

    if (!templateContent) {
      return fallback ?? "";
    }

    return this.applyTemplate(templateContent, context);
  }

  private normalizeDirectories(directories: string[]): string[] {
    const normalized = directories
      .map((dir) => (dir ? path.resolve(dir) : dir))
      .filter((dir): dir is string => Boolean(dir));

    // Deduplicate while preserving order
    return Array.from(new Set(normalized));
  }

  private async readTemplate(templatePath: string): Promise<string | undefined> {
    const asset = await this.orchestrator.resolveTemplateAsset(templatePath, {
      overrideDirectories: this.overrideDirectories,
      defaultDirectories: this.defaultDirectories,
    });
    return asset?.content;
  }

  private applyTemplate(content: string, context: Record<string, unknown>): string {
    const pattern = /{{{\s*([\w.]+)\s*}}}|{{\s*([\w.]+)\s*}}/g;

    return content.replace(pattern, (_match, tripleKey: string, doubleKey: string) => {
      const key = tripleKey || doubleKey;
      const value = this.lookupValue(context, key);
      if (value === undefined || value === null) {
        return "";
      }
      if (Array.isArray(value) || typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }

  private lookupValue(context: Record<string, unknown>, key: string): unknown {
    const segments = key.split(".");
    let current: any = context;

    for (const segment of segments) {
      if (current == null) {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }
}
