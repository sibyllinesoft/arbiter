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
 * Groups evidence and files by directory so downstream inference can reason about
 * a cohesive unit (package manifest + Dockerfile + compose entry, etc).
 */
export function buildDirectoryContexts(
  evidence: Evidence[],
  fileIndex: FileIndex,
  projectRoot: string,
): Map<string, DirectoryContext> {
  const contexts = new Map<string, DirectoryContext>();

  const ensureContext = (absoluteDir: string): DirectoryContext => {
    const relativePath = normalize(path.relative(projectRoot, absoluteDir));
    const key = relativePath || ".";
    const existing = contexts.get(key);
    if (existing) return existing;

    const directoryInfo = fileIndex.directories.get(absoluteDir);
    const ctx: DirectoryContext = {
      absolutePath: absoluteDir,
      relativePath: relativePath,
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

  // Seed contexts from evidence
  for (const ev of evidence) {
    const dir = path.dirname(ev.filePath);
    const ctx = ensureContext(dir);
    ctx.evidence.push(ev);
    if (ev.source === "docker" && ev.type === "config") {
      const dataType = typeof ev.data?.type === "string" ? ev.data.type.toLowerCase() : "";
      if (dataType === "dockerfile") {
        ctx.hasDockerfile = true;
        ctx.dockerBuild = {
          buildContext: dir,
          dockerfile: ev.filePath,
        };
      }
      if (dataType === "service") {
        ctx.hasComposeService = true;
      }
    }
  }

  // Propagate compose build contexts so classifiers know a directory is dockerized
  for (const ev of evidence) {
    if (ev.source !== "docker" || ev.type !== "config") continue;
    const data = ev.data as Record<string, unknown>;
    if (!data || typeof data !== "object") continue;
    const dataTypeRaw = data.type;
    const dataType = typeof dataTypeRaw === "string" ? dataTypeRaw.toLowerCase() : "";
    if (dataType !== "service") continue;

    const composeDir = path.dirname(ev.filePath);
    const composeCtx = ensureContext(composeDir);
    composeCtx.hasComposeService = true;

    const build = (data.composeServiceConfig as any)?.build;
    let buildContextAbs: string | undefined;
    let dockerfileAbs: string | undefined;

    if (typeof build === "string") {
      buildContextAbs = path.resolve(composeDir, build);
      dockerfileAbs = path.join(buildContextAbs, "Dockerfile");
    } else if (build && typeof build === "object") {
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

    const targets = [buildContextAbs, dockerfileAbs].filter(Boolean) as string[];
    for (const target of targets) {
      const targetDir =
        path.extname(target).toLowerCase() === ".yml" ? path.dirname(target) : target;
      const ctx = ensureContext(targetDir);
      ctx.hasDockerfile = ctx.hasDockerfile || target.endsWith("Dockerfile");
      ctx.dockerBuild = {
        buildContext: buildContextAbs,
        dockerfile: dockerfileAbs,
      };
    }
  }

  // Attach files & file patterns for directories that already have evidence to avoid O(n^2).
  const evidenceDirectories = new Set<string>(
    Array.from(contexts.values()).map((ctx) => normalize(ctx.absolutePath)),
  );

  for (const file of fileIndex.files.values()) {
    const absoluteDir = path.dirname(file.path);
    const normalizedDir = normalize(absoluteDir);
    if (!evidenceDirectories.has(normalizedDir)) {
      continue;
    }

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

  // De-duplicate file patterns for each context
  for (const ctx of contexts.values()) {
    ctx.filePatterns = Array.from(new Set(ctx.filePatterns)).sort();
  }

  return contexts;
}
