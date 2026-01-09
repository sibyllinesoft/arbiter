/**
 * @module project-analysis/file-classifier
 * File classification logic for project analysis.
 */

import path from "node:path";
import {
  DATABASE_HINTS,
  DOCKER_COMPOSE_FILES,
  isInfrastructureYaml,
  makeArtifactId,
  prettifyName,
} from "../../parsers/helpers";
import type { AnalyzedArtifact } from "../project-analysis.types";

/**
 * Classifies a file into an artifact type based on filename patterns.
 */
export function classifyFile(projectId: string, filePath: string): AnalyzedArtifact | null {
  const lower = filePath.toLowerCase();
  const base = path.basename(lower);
  const ext = path.extname(lower);
  const name = prettifyName(filePath);
  const id = makeArtifactId(projectId, filePath);

  if (base === "package.json") {
    return {
      id,
      name,
      type: "package",
      description: "Node package manifest detected.",
      language: "JavaScript",
      framework: null,
      metadata: { filePath },
      filePath,
      links: [],
    };
  }

  if (base === "cargo.toml") {
    return {
      id,
      name,
      type: "package",
      description: "Rust Cargo manifest detected.",
      language: "Rust",
      framework: null,
      metadata: { filePath },
      filePath,
      links: [],
    };
  }

  if (base === "dockerfile" || base.startsWith("dockerfile.")) {
    const parentDir = path.basename(path.dirname(filePath));
    const dockerfileSuffix = base === "dockerfile" ? "" : `-${base.replace("dockerfile.", "")}`;
    const contextName = parentDir && parentDir !== "." ? `${parentDir}${dockerfileSuffix}` : name;
    return {
      id,
      name: `${contextName}-container`,
      type: "infrastructure",
      description: `Dockerfile for ${contextName} containerized deployment.`,
      language: null,
      framework: null,
      metadata: { filePath, dockerfile: true, context: parentDir },
      filePath,
      links: [],
    };
  }

  if (DOCKER_COMPOSE_FILES.has(base)) {
    const displayName = path.basename(filePath);
    return {
      id,
      name: displayName,
      type: "infrastructure",
      description: `Docker Compose configuration detected in ${displayName}.`,
      language: null,
      framework: null,
      metadata: { filePath, compose: true },
      filePath,
      links: [],
    };
  }

  if (ext === ".cue") {
    return {
      id,
      name: `${name}-cue`,
      type: "config",
      description: "CUE configuration file detected.",
      language: null,
      framework: null,
      metadata: { filePath, cue: true },
      filePath,
      links: [],
    };
  }

  if ((ext === ".yaml" || ext === ".yml") && isInfrastructureYaml(base)) {
    const pathParts = filePath.split(path.sep);
    const parentDir = pathParts.length > 1 ? pathParts[pathParts.length - 2] : "";
    const contextName = parentDir && parentDir !== "." ? `${parentDir}/${name}` : name;
    return {
      id,
      name: `${contextName}-k8s`,
      type: "infrastructure",
      description: `Kubernetes resource: ${contextName}.`,
      language: null,
      framework: null,
      metadata: { filePath, kubernetes: true, context: parentDir },
      filePath,
      links: [],
    };
  }

  if (ext === ".tf" || ext === ".tf.json") {
    return {
      id,
      name: `${name}-terraform`,
      type: "infrastructure",
      description: "Terraform IaC file detected.",
      language: null,
      framework: null,
      metadata: { filePath, terraform: true },
      filePath,
      links: [],
    };
  }

  if (DATABASE_HINTS.some((hint) => lower.includes(hint))) {
    return {
      id,
      name: `${name}-database`,
      type: "database",
      description: "Database-related definition detected.",
      language: null,
      framework: null,
      metadata: { filePath, hint: "database-file-name" },
      filePath,
      links: [],
    };
  }

  return null;
}
