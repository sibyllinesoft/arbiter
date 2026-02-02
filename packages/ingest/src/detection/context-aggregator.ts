import * as path from "path";
import { type DirectoryInfo, type Evidence, type FileIndex, type FileInfo } from "../types";

interface DockerServiceBuildInfo {
  buildContext?: string;
  dockerfile?: string;
}

/**
 * Bundled evidence and file information scoped to a single directory.
 */
export interface DirectoryContext {
  /** Absolute directory path */
  absolutePath: string;
  /** Directory path relative to project root ("" represents root) */
  relativePath: string;
  /** Evidence items that originate from this directory */
  evidence: Evidence[];
  /** Files that reside in (or below) this directory */
  files: FileInfo[];
  /** File patterns relative to this directory, e.g. `Dockerfile`, `src/index.ts` */
  filePatterns: string[];
  /** True when a Dockerfile or compose build context exists within this directory */
  hasDockerfile: boolean;
  /** True when a compose service was defined alongside this directory */
  hasComposeService: boolean;
  /** Compose build metadata if derived from docker evidence */
  dockerBuild?: DockerServiceBuildInfo;
  /** Raw directory metadata from the file index when available */
  directoryInfo?: DirectoryInfo;
}

const normalize = (value: string): string => value.replace(/\\/g, "/").replace(/^\.\//, "");

/**
 * Helper to ensure a context exists for a given directory.
 */
function createContextFactory(
  contexts: Map<string, DirectoryContext>,
  fileIndex: FileIndex,
  projectRoot: string,
) {
  return (absoluteDir: string): DirectoryContext => {
    const relativePath = normalize(path.relative(projectRoot, absoluteDir));
    const key = relativePath || ".";
    const existing = contexts.get(key);
    if (existing) return existing;

    const directoryInfo = fileIndex.directories.get(absoluteDir);
    const ctx: DirectoryContext = {
      absolutePath: absoluteDir,
      relativePath,
      evidence: [],
      files: [],
      filePatterns: [],
      hasDockerfile: false,
      hasComposeService: false,
      directoryInfo,
    };
    contexts.set(key, ctx);
    return ctx;
  };
}

/**
 * Groups evidence and files by directory so downstream inference can reason about
 * a cohesive unit (package manifest + Dockerfile + compose entry, etc).
 */
export function buildDirectoryContexts(
  evidence: Evidence[],
  fileIndex: FileIndex,
  projectRoot: string,
): Map<string, DirectoryContext> {
  const contexts = new Map<string, DirectoryContext>();
  const ensureContext = createContextFactory(contexts, fileIndex, projectRoot);

  seedContextsFromEvidence(evidence, ensureContext);
  propagateComposeBuildContexts(evidence, ensureContext);
  attachFilesAndPatterns(contexts, fileIndex, ensureContext);
  deduplicateFilePatterns(contexts);

  return contexts;
}

/**
 * Seeds contexts from evidence and marks docker-related flags.
 */
function seedContextsFromEvidence(
  evidence: Evidence[],
  ensureContext: (dir: string) => DirectoryContext,
): void {
  for (const ev of evidence) {
    const dir = path.dirname(ev.filePath);
    const ctx = ensureContext(dir);
    ctx.evidence.push(ev);

    if (ev.source === "docker" && ev.type === "config") {
      markDockerFlags(ctx, ev, dir);
    }
  }
}

/**
 * Marks docker-related flags on a context based on evidence.
 */
function markDockerFlags(ctx: DirectoryContext, ev: Evidence, dir: string): void {
  const dataType = typeof ev.data?.type === "string" ? ev.data.type.toLowerCase() : "";

  if (dataType === "dockerfile") {
    ctx.hasDockerfile = true;
    ctx.dockerBuild = { buildContext: dir, dockerfile: ev.filePath };
  }
  if (dataType === "service") {
    ctx.hasComposeService = true;
  }
}

/**
 * Propagates compose build contexts so classifiers know a directory is dockerized.
 */
function propagateComposeBuildContexts(
  evidence: Evidence[],
  ensureContext: (dir: string) => DirectoryContext,
): void {
  for (const ev of evidence) {
    if (!isComposeServiceEvidence(ev)) continue;

    const data = ev.data as Record<string, unknown>;
    const composeDir = path.dirname(ev.filePath);
    const composeCtx = ensureContext(composeDir);
    composeCtx.hasComposeService = true;

    const buildInfo = resolveBuildPaths(data, composeDir);
    if (buildInfo) {
      applyBuildInfoToContexts(buildInfo, ensureContext);
    }
  }
}

/**
 * Checks if evidence represents a compose service.
 */
function isComposeServiceEvidence(ev: Evidence): boolean {
  if (ev.source !== "docker" || ev.type !== "config") return false;
  const data = ev.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return false;
  const dataType = typeof data.type === "string" ? data.type.toLowerCase() : "";
  return dataType === "service";
}

/**
 * Resolves build context and dockerfile paths from compose service config.
 */
function resolveBuildPaths(
  data: Record<string, unknown>,
  composeDir: string,
): { buildContextAbs?: string; dockerfileAbs?: string } | null {
  const build = (data.composeServiceConfig as any)?.build;
  if (!build) return null;

  let buildContextAbs: string | undefined;
  let dockerfileAbs: string | undefined;

  if (typeof build === "string") {
    buildContextAbs = path.resolve(composeDir, build);
    dockerfileAbs = path.join(buildContextAbs, "Dockerfile");
  } else if (typeof build === "object") {
    const contextVal = (build as Record<string, unknown>).context;
    const dockerfileVal = (build as Record<string, unknown>).dockerfile;
    buildContextAbs =
      typeof contextVal === "string" ? path.resolve(composeDir, contextVal) : composeDir;

    if (typeof dockerfileVal === "string") {
      dockerfileAbs = path.resolve(buildContextAbs, dockerfileVal);
    } else if (buildContextAbs) {
      dockerfileAbs = path.join(buildContextAbs, "Dockerfile");
    }
  }

  return { buildContextAbs, dockerfileAbs };
}

/**
 * Applies build info to target contexts.
 */
function applyBuildInfoToContexts(
  buildInfo: { buildContextAbs?: string; dockerfileAbs?: string },
  ensureContext: (dir: string) => DirectoryContext,
): void {
  const targets = [buildInfo.buildContextAbs, buildInfo.dockerfileAbs].filter(Boolean) as string[];

  for (const target of targets) {
    const targetDir = path.extname(target).toLowerCase() === ".yml" ? path.dirname(target) : target;
    const ctx = ensureContext(targetDir);
    ctx.hasDockerfile = ctx.hasDockerfile || target.endsWith("Dockerfile");
    ctx.dockerBuild = {
      buildContext: buildInfo.buildContextAbs,
      dockerfile: buildInfo.dockerfileAbs,
    };
  }
}

/**
 * Attaches files and file patterns to contexts that have evidence.
 */
function attachFilesAndPatterns(
  contexts: Map<string, DirectoryContext>,
  fileIndex: FileIndex,
  ensureContext: (dir: string) => DirectoryContext,
): void {
  const evidenceDirectories = new Set<string>(
    Array.from(contexts.values()).map((ctx) => normalize(ctx.absolutePath)),
  );

  for (const file of fileIndex.files.values()) {
    const absoluteDir = path.dirname(file.path);
    const normalizedDir = normalize(absoluteDir);
    if (!evidenceDirectories.has(normalizedDir)) continue;

    const ctx = ensureContext(absoluteDir);
    ctx.files.push(file);

    const relativeToDir = normalize(
      path.relative(absoluteDir, file.path.replace(/\\/g, "/")),
    ).replace(/^\.\//, "");
    ctx.filePatterns.push(relativeToDir || path.basename(file.path));

    if (path.basename(file.path).toLowerCase() === "dockerfile") {
      ctx.hasDockerfile = true;
    }
  }
}

/**
 * De-duplicates file patterns for each context.
 */
function deduplicateFilePatterns(contexts: Map<string, DirectoryContext>): void {
  for (const ctx of contexts.values()) {
    ctx.filePatterns = Array.from(new Set(ctx.filePatterns)).sort();
  }
}
