/**
 * @packageDocumentation
 * Client subcommand module - Handles adding client applications to CUE specifications.
 *
 * Supports creating frontend clients with:
 * - Template-based scaffolding
 * - Language/framework configuration
 * - Directory structure management
 */

import path from "node:path";
import { parseTags } from "@/services/add/shared.js";
import { executeTemplate, validateTemplateExists } from "@/services/add/template-engine.js";
import fs from "fs-extra";

/** Options for client template configuration */
interface ClientTemplateOptions {
  language?: string;
  template?: string;
  directory?: string;
  framework?: string;
  port?: number;
  description?: string;
  tags?: string;
  [key: string]: any;
}

function buildClientSlug(clientName: string): string {
  return (
    clientName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client"
  );
}

function buildClientConfig(
  language: string,
  targetDir: string,
  options: ClientTemplateOptions,
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    language,
    sourceDirectory: targetDir,
  };

  if (options.template) config.template = options.template;
  if (options.framework) config.framework = options.framework;
  if (typeof options.port === "number" && !Number.isNaN(options.port)) {
    config.port = options.port;
  }
  if (options.description) config.description = options.description;

  const parsedTags = parseTags(options.tags);
  if (parsedTags?.length) config.tags = parsedTags;

  return config;
}

/**
 * Add a client application to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param clientName - Name of the client application
 * @param options - Client configuration options
 * @returns Updated CUE file content
 */
export async function addClient(
  manipulator: any,
  content: string,
  clientName: string,
  options: ClientTemplateOptions,
): Promise<string> {
  const slug = buildClientSlug(clientName);
  const language = options.language ?? "typescript";
  const targetDir = options.directory ?? path.join("clients", slug).replace(/\\/g, "/");

  if (options.template) {
    await validateTemplateExists(options.template);
    await executeTemplate(clientName, options.template, content, targetDir, {
      language,
      clientName,
      projectName: path.basename(process.cwd()),
      description: options.description,
      tags: parseTags(options.tags),
      port: options.port,
      artifactKind: "client",
    });
  } else if (targetDir) {
    await fs.ensureDir(path.resolve(targetDir));
  }

  const clientConfig = buildClientConfig(language, targetDir, options);
  return await manipulator.addToSection(content, "clients", slug, clientConfig);
}
