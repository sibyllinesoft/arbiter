import path from 'node:path';
import fs from 'fs-extra';

export interface TemplateResolverOptions {
  language: string;
  overrideDirectories?: string[];
  defaultDirectories?: string[];
}

export class TemplateResolver {
  private readonly language: string;
  private overrideDirectories: string[] = [];
  private defaultDirectories: string[] = [];

  constructor(options: TemplateResolverOptions) {
    this.language = options.language;
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
    fallback: string
  ): Promise<string> {
    const templateContent = await this.readTemplate(templatePath);

    if (!templateContent) {
      return fallback;
    }

    return this.applyTemplate(templateContent, context);
  }

  private normalizeDirectories(directories: string[]): string[] {
    const normalized = directories
      .map(dir => (dir ? path.resolve(dir) : dir))
      .filter((dir): dir is string => Boolean(dir));

    // Deduplicate while preserving order
    return Array.from(new Set(normalized));
  }

  private async readTemplate(templatePath: string): Promise<string | undefined> {
    const searchPaths = [...this.overrideDirectories, ...this.defaultDirectories];

    for (const baseDir of searchPaths) {
      const candidatePath = path.join(baseDir, templatePath);
      if (await fs.pathExists(candidatePath)) {
        return fs.readFile(candidatePath, 'utf-8');
      }
    }

    return undefined;
  }

  private applyTemplate(content: string, context: Record<string, unknown>): string {
    const pattern = /{{{\s*([\w.]+)\s*}}}|{{\s*([\w.]+)\s*}}/g;

    return content.replace(pattern, (_match, tripleKey: string, doubleKey: string) => {
      const key = tripleKey || doubleKey;
      const value = this.lookupValue(context, key);
      if (value === undefined || value === null) {
        return '';
      }
      if (Array.isArray(value) || typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    });
  }

  private lookupValue(context: Record<string, unknown>, key: string): unknown {
    const segments = key.split('.');
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
