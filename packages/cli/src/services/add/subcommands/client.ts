import path from "node:path";
import { parseTags } from "@/services/add/shared.js";
import { executeTemplate, validateTemplateExists } from "@/services/add/template-engine.js";
import fs from "fs-extra";

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

export async function addClient(
  manipulator: any,
  content: string,
  clientName: string,
  options: ClientTemplateOptions,
): Promise<string> {
  const slug =
    clientName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client";
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

  const clientConfig: Record<string, unknown> = {
    language,
    sourceDirectory: targetDir,
  };
  if (options.template) clientConfig.template = options.template;
  if (options.framework) clientConfig.framework = options.framework;
  if (typeof options.port === "number" && !Number.isNaN(options.port)) {
    clientConfig.port = options.port;
  }
  if (options.description) clientConfig.description = options.description;
  const parsedTags = parseTags(options.tags);
  if (parsedTags?.length) clientConfig.tags = parsedTags;

  return await manipulator.addToSection(content, "clients", slug, clientConfig);
}
