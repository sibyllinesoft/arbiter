/**
 * @packageDocumentation
 * Template engine for the add command module.
 *
 * Provides functionality to:
 * - Validate template existence
 * - Execute templates with context
 * - Build template context from CUE content
 */

import path from "node:path";
import { buildTemplateContext, templateOrchestrator } from "@/templates/index.js";
import chalk from "chalk";
import fs from "fs-extra";

export async function validateTemplateExists(template: string): Promise<void> {
  await templateOrchestrator.loadConfig();

  const alias = templateOrchestrator.getAlias(template);
  if (!alias) {
    const availableTemplates = Object.keys(templateOrchestrator.getAliases());
    throw new Error(
      `Template '${template}' not found. Available templates: ${availableTemplates.join(", ")}`,
    );
  }
}

export function validateTemplateExistsSync(template: string): void {
  const alias = templateOrchestrator.getAlias(template);
  if (!alias) {
    const availableTemplates = Object.keys(templateOrchestrator.getAliases());
    throw new Error(
      `Template '${template}' not found. Available templates: ${availableTemplates.join(", ")}`,
    );
  }
}

export async function executeTemplate(
  artifactName: string,
  template: string,
  content: string,
  directory: string,
  options: Record<string, any>,
): Promise<void> {
  console.log(chalk.blue(`🔧 Generating '${artifactName}' using template '${template}'`));

  const fallback: Record<string, unknown> = {
    name: artifactName,
    kind: options.artifactKind ?? "service",
  };
  if (options.language) {
    fallback.language = options.language;
  }
  if (options.port) {
    fallback.ports = [{ name: "http", port: options.port, targetPort: options.port }];
  }

  const context = await buildTemplateContext(content, {
    artifactName,
    artifactFallback: fallback,
    impl: {
      artifactName,
      template,
      options,
    },
  });

  await fs.ensureDir(path.resolve(directory));
  await templateOrchestrator.executeTemplate(template, path.resolve(directory), context);

  console.log(chalk.green(`✅ Template '${template}' applied successfully to '${directory}'`));
}
