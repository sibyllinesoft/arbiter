/**
 * @module project-analysis
 * Project file analysis and artifact extraction.
 */

import path from "node:path";
import { collectParserTargets } from "../../parsers";
import {
  DOCKER_COMPOSE_FILES,
  PACKAGE_MANIFESTS,
  isConfigJson,
  isInfrastructureYaml,
  makeArtifactId,
  prettifyName,
} from "../../parsers/helpers";
import type { ProjectStructure } from "../../scanner/git-scanner.types";
import { FetchQueue } from "../../util/fetch-queue";
import type { ContentFetcher } from "../content-fetcher";
import type { AnalyzedArtifact, TreeAnalysisResult } from "../project-analysis.types";
import { classifyFile } from "./file-classifier";
import { annotateFrontendRoutes } from "./frontend-routes";
import type { AnalysisOptions, StructureMetrics } from "./types";

export type { StructureMetrics, AnalysisOptions, FrontendRouteInfo } from "./types";
export { classifyFile } from "./file-classifier";
export { extractNextRoutes, normalizeRelativePath } from "./next-routes";
export { extractReactRouterRoutes } from "./react-router-parser";
export { annotateFrontendRoutes } from "./frontend-routes";

/**
 * Builds a project structure summary from file list.
 */
export function buildProjectStructure(
  files: string[],
  metrics?: StructureMetrics,
): ProjectStructure {
  const structure: ProjectStructure = {
    hasPackageJson: false,
    hasCargoToml: false,
    hasDockerfile: false,
    hasCueFiles: false,
    hasYamlFiles: false,
    hasJsonFiles: false,
    importableFiles: [],
  };

  for (const file of files) {
    const lower = file.toLowerCase();
    const ext = path.extname(lower);
    const base = path.basename(lower);

    if (PACKAGE_MANIFESTS.has(base)) {
      structure.hasPackageJson = true;
      structure.importableFiles.push(file);
    } else if (base === "cargo.toml") {
      structure.hasCargoToml = true;
      structure.importableFiles.push(file);
    } else if (base === "dockerfile" || base.startsWith("dockerfile.")) {
      structure.hasDockerfile = true;
      structure.importableFiles.push(file);
    } else if (ext === ".cue") {
      structure.hasCueFiles = true;
      structure.importableFiles.push(file);
    } else if (ext === ".yaml" || ext === ".yml") {
      structure.hasYamlFiles = true;
      if (isInfrastructureYaml(base)) {
        structure.importableFiles.push(file);
      }
    } else if (ext === ".json") {
      structure.hasJsonFiles = true;
      if (isConfigJson(base)) {
        structure.importableFiles.push(file);
      }
    } else if (ext === ".tf" || ext === ".tf.json") {
      structure.importableFiles.push(file);
    }
  }

  if (metrics) {
    structure.performanceMetrics = {
      filesScanned: metrics.filesScanned,
      usedGitLsFiles: metrics.usedGitLsFiles,
    };
  }

  structure.importableFiles = Array.from(new Set(structure.importableFiles));
  return structure;
}

/** Classify files and build initial artifact list */
function classifyFiles(
  projectId: string,
  files: string[],
): { artifacts: AnalyzedArtifact[]; artifactsByPath: Map<string, AnalyzedArtifact> } {
  const artifacts: AnalyzedArtifact[] = [];
  const artifactsByPath = new Map<string, AnalyzedArtifact>();

  for (const file of files) {
    const classified = classifyFile(projectId, file);
    if (!classified) continue;

    const enriched = {
      ...classified,
      metadata: {
        ...classified.metadata,
        detectedBy: "tree-analysis",
      },
    } satisfies AnalyzedArtifact;

    artifacts.push(enriched);
    artifactsByPath.set(file, enriched);
  }

  return { artifacts, artifactsByPath };
}

/** Parse files using the fetch queue and add discovered artifacts */
async function parseFilesWithFetcher(
  projectId: string,
  projectName: string,
  files: string[],
  structure: ProjectStructure,
  options: AnalysisOptions,
  artifacts: AnalyzedArtifact[],
  artifactsByPath: Map<string, AnalyzedArtifact>,
): Promise<void> {
  if (!options.fetcher) return;

  const queue = new FetchQueue((p) => options.fetcher!.fetchText(p), options.maxConcurrency ?? 4);
  const parseTargets = collectParserTargets(files);

  const parsePromises = parseTargets.map((target) =>
    queue.enqueue(target.path, target.priority).then(async (content) => {
      if (!content) return;
      await target.parser.parse(content, {
        projectId,
        projectName,
        filePath: target.path,
        artifact: artifactsByPath.get(target.path),
        addArtifact: (artifact) => {
          artifacts.push(artifact);
          if (artifact.filePath) {
            artifactsByPath.set(artifact.filePath, artifact);
          }
        },
        structure,
        allFiles: files,
      });
    }),
  );

  await Promise.all(parsePromises);
}

/** Build a map of artifacts indexed by name and path */
function buildArtifactsByName(artifacts: AnalyzedArtifact[]): Map<string, AnalyzedArtifact> {
  const artifactsByName = new Map<string, AnalyzedArtifact>();
  for (const artifact of artifacts) {
    artifactsByName.set(artifact.name, artifact);
    if (artifact.filePath) {
      artifactsByName.set(artifact.filePath, artifact);
    }
    const pkgMetadata = artifact.metadata?.package as { name?: string } | undefined;
    if (pkgMetadata?.name) {
      artifactsByName.set(pkgMetadata.name, artifact);
    }
  }
  return artifactsByName;
}

/** Merge links into artifact metadata */
function mergeLinksToMetadata(artifacts: AnalyzedArtifact[]): void {
  for (const artifact of artifacts) {
    if (artifact.links && artifact.links.length > 0) {
      artifact.metadata = { ...artifact.metadata, links: artifact.links };
    }
  }
}

/** Add fallback service from docker-compose if no services detected */
function addFallbackServiceFromCompose(
  projectId: string,
  files: string[],
  artifacts: AnalyzedArtifact[],
): void {
  if (artifacts.some((a) => a.type === "service")) return;

  const composeFile = files.find((file) =>
    DOCKER_COMPOSE_FILES.has(path.basename(file).toLowerCase()),
  );
  if (!composeFile) return;

  const id = makeArtifactId(projectId, `${composeFile}#placeholder-service`);
  artifacts.push({
    id,
    name: `${prettifyName(composeFile)}-service`,
    type: "service",
    description: "Service inferred from docker-compose presence.",
    language: null,
    framework: null,
    metadata: { composeFile, inferred: "docker-compose" },
    filePath: composeFile,
    links: [{ type: "defined_in", target: composeFile }],
  });
}

/**
 * Analyzes project files and extracts artifacts.
 */
export async function analyzeProjectFiles(
  projectId: string,
  projectName: string,
  files: string[],
  options: AnalysisOptions = {},
): Promise<TreeAnalysisResult> {
  const structure = options.structure ?? buildProjectStructure(files);
  const { artifacts, artifactsByPath } = classifyFiles(projectId, files);

  await parseFilesWithFetcher(
    projectId,
    projectName,
    files,
    structure,
    options,
    artifacts,
    artifactsByPath,
  );

  const artifactsByName = buildArtifactsByName(artifacts);

  if (options.projectRoot) {
    await annotateFrontendRoutes(
      artifacts,
      artifactsByPath,
      artifactsByName,
      options.projectRoot,
      projectName,
      files,
    );
  }

  mergeLinksToMetadata(artifacts);
  addFallbackServiceFromCompose(projectId, files, artifacts);

  return {
    structure,
    artifacts,
    serviceCount: artifacts.filter((a) => a.type === "service").length,
    databaseCount: artifacts.filter((a) => a.type === "database").length,
  };
}
