import { createHash } from "node:crypto";
import path from "node:path";
import { ScannerRunner } from "@arbiter/importer";
import { NodeJSPlugin, goPlugin, pythonPlugin, rustPlugin } from "@arbiter/importer/plugins";
import type { ContentFetcher } from "../git/content-fetcher";
import { createGithubContentFetcher, createLocalContentFetcher } from "../git/content-fetcher";
import { gitScanner } from "../git/git-scanner";
import { parseGitUrl } from "../git/git-url";
import { analyzeProjectFiles } from "../git/project-analysis";
import type { EventService } from "../io/events";
import { AppError } from "../scanner/errors";
import type { CreateProjectDto } from "../schemas/project";
import type { SpecWorkbenchDB } from "../util/db";
import { DEFAULT_STRUCTURE, type PresetProjectData, PresetService } from "./PresetService";

interface ProjectCreateDependencies {
  db: SpecWorkbenchDB;
  events?: EventService;
  presetService?: PresetService;
}

export interface CreateProjectResult {
  id: string;
  name: string;
  services: number;
  databases: number;
  artifacts: number;
  structure: Record<string, unknown>;
  presetResolvedSpec?: Record<string, unknown>;
}

interface ProjectArtifact {
  id: string;
  name: string;
  type: string;
  description: string | null;
  language: string | null;
  framework: string | null;
  metadata?: Record<string, unknown> | null;
  filePath?: string | null;
}

interface PathAnalysisResult {
  artifacts: ProjectArtifact[];
  serviceCount: number;
  databaseCount: number;
  structure: Record<string, unknown>;
}

interface ScanContext {
  files: string[];
  structure: Record<string, unknown> | undefined;
  gitUrl: string | undefined;
  branch: string | undefined;
  contentFetcher: ContentFetcher | undefined;
  cleanupNeeded: boolean;
}

function generateProjectId(requestedId?: string): string {
  const trimmedId =
    typeof requestedId === "string" && requestedId.trim().length > 0
      ? requestedId.trim()
      : undefined;
  return trimmedId ?? `project-${Date.now()}`;
}

function countSpecEntities(spec: Record<string, unknown> | undefined, key: string): number {
  const entities = (spec?.spec as Record<string, unknown>)?.[key] as
    | Record<string, unknown>
    | undefined;
  return entities ? Object.keys(entities).length : 0;
}

export class ProjectService {
  private presetService: PresetService;

  constructor(private readonly deps: ProjectCreateDependencies) {
    this.presetService = deps.presetService ?? new PresetService();
  }

  async createProject(dto: CreateProjectDto): Promise<CreateProjectResult> {
    const { db, events } = this.deps;
    const projectId = generateProjectId(dto.id);

    if (dto.id?.trim()) {
      const existingProject = await db.getProject(dto.id.trim());
      if (existingProject) {
        throw new AppError(409, "Project already exists");
      }
    }

    let result: {
      services: number;
      databases: number;
      artifacts: ProjectArtifact[];
      structure: Record<string, unknown>;
      presetData?: PresetProjectData | null;
    };

    if (dto.presetId) {
      result = this.createFromPreset(dto.presetId, projectId, dto.name);
    } else if (dto.path) {
      const analysis = await this.analyzePath(projectId, dto.name, dto.path);
      result = { ...analysis, presetData: null };
    } else {
      result = {
        services: 0,
        databases: 0,
        artifacts: [],
        structure: { ...DEFAULT_STRUCTURE },
        presetData: null,
      };
    }

    const project = await db.createProject(projectId, dto.name, result.services, result.databases);
    await this.persistArtifacts(db, projectId, result.artifacts);

    if (result.presetData?.resolvedSpec) {
      await this.persistResolvedSpec(db, project.id, result.presetData.resolvedSpec);
    }

    await this.broadcastProjectCreated(events, project);

    return {
      id: project.id,
      name: project.name,
      services: result.services,
      databases: result.databases,
      artifacts: result.artifacts.length,
      structure: result.structure,
      presetResolvedSpec: result.presetData?.resolvedSpec,
    };
  }

  private createFromPreset(presetId: string, projectId: string, projectName: string) {
    const presetData = this.presetService.getPreset(presetId, projectId, projectName);

    const artifacts: ProjectArtifact[] = (presetData?.artifacts ?? []).map((artifact, index) => ({
      id: `${projectId}-preset-artifact-${index + 1}`,
      name: artifact.name,
      type: artifact.type,
      description:
        typeof artifact.description === "string" ? artifact.description.trim() || null : null,
      filePath: artifact.filePath ?? null,
      language: artifact.language ?? null,
      framework: artifact.framework ?? null,
      metadata: artifact.metadata,
    }));

    return {
      artifacts,
      services: countSpecEntities(presetData?.resolvedSpec as Record<string, unknown>, "services"),
      databases: countSpecEntities(
        presetData?.resolvedSpec as Record<string, unknown>,
        "databases",
      ),
      structure: presetData?.structure ? { ...presetData.structure } : { ...DEFAULT_STRUCTURE },
      presetData,
    };
  }

  private async persistArtifacts(
    db: SpecWorkbenchDB,
    projectId: string,
    artifacts: ProjectArtifact[],
  ): Promise<void> {
    for (const artifact of artifacts) {
      try {
        await db.createArtifact(
          artifact.id,
          projectId,
          artifact.name,
          artifact.description,
          artifact.type,
          artifact.language,
          artifact.framework,
          artifact.metadata,
          artifact.filePath,
        );
      } catch (error) {
        console.warn(`Failed to create artifact ${artifact.name}:`, error);
      }
    }
  }

  private async persistResolvedSpec(
    db: SpecWorkbenchDB,
    projectId: string,
    resolvedSpec: Record<string, unknown>,
  ): Promise<void> {
    const resolvedJson = JSON.stringify(resolvedSpec, null, 2);
    const specHash = createHash("sha1").update(resolvedJson).digest("hex");
    await db.createVersion(`version-${Date.now()}`, projectId, specHash, resolvedJson);
  }

  private async broadcastProjectCreated(
    events: EventService | undefined,
    project: { id: string; name: string },
  ): Promise<void> {
    if (!events?.broadcastToAll) return;

    await events.broadcastToAll({
      type: "event",
      data: {
        event_type: "project_created",
        project_id: project.id,
        project_name: project.name,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private async analyzePath(
    projectId: string,
    projectName: string,
    projectPath: string,
  ): Promise<PathAnalysisResult> {
    const context = await this.buildScanContext(projectPath);

    try {
      if (context.files.length === 0) {
        return {
          artifacts: [],
          serviceCount: 0,
          databaseCount: 0,
          structure: { ...DEFAULT_STRUCTURE },
        };
      }

      return await this.runAnalysis(projectId, projectName, projectPath, context);
    } finally {
      if (context.cleanupNeeded && gitScanner.cleanupAll) {
        await gitScanner.cleanupAll();
      }
    }
  }

  private async buildScanContext(projectPath: string): Promise<ScanContext> {
    let context: ScanContext = {
      files: [],
      structure: undefined,
      gitUrl: undefined,
      branch: undefined,
      contentFetcher: undefined,
      cleanupNeeded: false,
    };

    const resolved = gitScanner.resolveTempPath
      ? await gitScanner.resolveTempPath(projectPath)
      : null;
    if (resolved?.success) {
      context = this.buildContextFromGitResolution(resolved, context);
    }

    if (context.files.length === 0) {
      const scanResult = await gitScanner.scanLocalPath(projectPath);
      if (scanResult.success) {
        context.files = scanResult.files ?? [];
        context.structure = scanResult.projectStructure;
        context.contentFetcher = createLocalContentFetcher(projectPath);
        context.branch = scanResult.branch;
      }
    }

    return context;
  }

  private buildContextFromGitResolution(
    resolved: Record<string, unknown>,
    base: ScanContext,
  ): ScanContext {
    const context = { ...base };
    context.files = (resolved.files as string[]) ?? [];
    context.structure = resolved.projectStructure as Record<string, unknown>;
    context.gitUrl = resolved.gitUrl as string | undefined;
    context.branch = resolved.branch as string | undefined;
    context.cleanupNeeded = true;

    if (context.gitUrl) {
      const parsedGit = parseGitUrl(context.gitUrl);
      if (parsedGit) {
        const ref = context.branch ?? parsedGit.ref ?? "main";
        const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
        context.contentFetcher = createGithubContentFetcher({
          owner: parsedGit.owner,
          repo: parsedGit.repo,
          ref,
          token,
        });
      }
    }

    return context;
  }

  private async runAnalysis(
    projectId: string,
    projectName: string,
    projectPath: string,
    context: ScanContext,
  ): Promise<PathAnalysisResult> {
    const absoluteProjectRoot = projectPath ? path.resolve(projectPath) : undefined;

    const analysis = await analyzeProjectFiles(projectId, projectName, context.files, {
      gitUrl: context.gitUrl,
      structure: context.structure,
      branch: context.branch,
      fetcher: context.contentFetcher,
      projectRoot: absoluteProjectRoot,
    });

    const artifacts: ProjectArtifact[] = analysis.artifacts;
    let { serviceCount, databaseCount } = analysis;
    const structure = analysis.structure ?? { ...DEFAULT_STRUCTURE };

    if (absoluteProjectRoot) {
      const importerArtifacts = await this.runImporterPipeline(absoluteProjectRoot, projectName);
      const result = this.mergeImporterArtifacts(
        artifacts,
        importerArtifacts,
        serviceCount,
        databaseCount,
      );
      return {
        artifacts: result.artifacts,
        serviceCount: result.serviceCount,
        databaseCount: result.databaseCount,
        structure,
      };
    }

    return { artifacts, serviceCount, databaseCount, structure };
  }

  /** Convert an importer artifact to a ProjectArtifact */
  private toProjectArtifact(raw: Record<string, unknown>): ProjectArtifact {
    const metadata = (raw.metadata as Record<string, unknown>) || {};
    return {
      id: raw.id as string,
      name: raw.name as string,
      type: raw.type as string,
      description: (raw.description as string) || null,
      language: (metadata.language as string) || null,
      framework: (metadata.framework as string) || null,
      metadata,
      filePath: (metadata.sourceFile as string) || null,
    };
  }

  /** Get artifact type category for counting */
  private getArtifactCategory(type: string): "service" | "database" | null {
    if (type === "service") return "service";
    if (type === "database") return "database";
    return null;
  }

  private mergeImporterArtifacts(
    existing: ProjectArtifact[],
    imported: { artifact: Record<string, unknown> }[],
    serviceCount: number,
    databaseCount: number,
  ) {
    const artifacts = [...existing];
    const existingNames = new Set(existing.map((a) => a.name));

    for (const { artifact } of imported) {
      const name = artifact.name as string;
      if (existingNames.has(name)) continue;
      existingNames.add(name);

      artifacts.push(this.toProjectArtifact(artifact));

      const category = this.getArtifactCategory(artifact.type as string);
      if (category === "service") serviceCount++;
      else if (category === "database") databaseCount++;
    }

    return { artifacts, serviceCount, databaseCount };
  }

  private async runImporterPipeline(
    projectRoot: string,
    projectName: string,
  ): Promise<{ artifact: Record<string, unknown> }[]> {
    try {
      const scanner = new ScannerRunner({
        projectRoot,
        projectName,
        plugins: [new NodeJSPlugin(), rustPlugin, pythonPlugin, goPlugin],
        parseOptions: {
          deepAnalysis: false,
          targetLanguages: [],
          maxFileSize: 10 * 1024 * 1024,
          includeBinaries: false,
          patterns: { include: [], exclude: [] },
        },
        inferenceOptions: {
          minConfidence: 0.3,
          inferRelationships: false,
          maxDependencyDepth: 3,
          useHeuristics: true,
        },
        ignorePatterns: [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
          "target/**",
          "**/__pycache__/**",
        ],
        maxConcurrency: 10,
        debug: true,
      });

      const manifest = await scanner.scan();
      return manifest.artifacts as { artifact: Record<string, unknown> }[];
    } catch (error) {
      console.warn("[ProjectService] Importer pipeline failed:", error);
      return [];
    }
  }
}
