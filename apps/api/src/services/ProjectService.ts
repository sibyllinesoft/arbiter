import { createHash } from "node:crypto";
import path from "node:path";
import { ScannerRunner } from "@arbiter/importer";
import { NodeJSPlugin, goPlugin, pythonPlugin, rustPlugin } from "@arbiter/importer/plugins";
import type { ContentFetcher } from "../content-fetcher";
import { createGithubContentFetcher, createLocalContentFetcher } from "../content-fetcher";
import type { SpecWorkbenchDB } from "../db";
import { AppError } from "../errors";
import type { EventService } from "../events";
import { gitScanner } from "../git-scanner";
import { parseGitUrl } from "../git-url";
import { analyzeProjectFiles } from "../project-analysis";
import type { CreateProjectDto } from "../schemas/project";
import { DEFAULT_STRUCTURE, PresetService } from "./PresetService";

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

export class ProjectService {
  private presetService: PresetService;

  constructor(private readonly deps: ProjectCreateDependencies) {
    this.presetService = deps.presetService ?? new PresetService();
  }

  async createProject(dto: CreateProjectDto): Promise<CreateProjectResult> {
    const db = this.deps.db;
    const events = this.deps.events;
    const trimmedRequestedId =
      typeof dto.id === "string" && dto.id.trim().length > 0 ? dto.id.trim() : undefined;
    const projectId = trimmedRequestedId ?? `project-${Date.now()}`;

    if (trimmedRequestedId) {
      const existingProject = await db.getProject(trimmedRequestedId);
      if (existingProject) {
        throw new AppError(409, "Project already exists");
      }
    }

    let services = 0;
    let databases = 0;
    let artifacts: Array<{
      id: string;
      name: string;
      type: string;
      description: string | null;
      language: string | null;
      framework: string | null;
      metadata?: Record<string, unknown> | null;
      filePath?: string | null;
    }> = [];
    let detectedStructure: Record<string, unknown> | undefined;
    let presetData: { resolvedSpec?: Record<string, unknown> } | null = null;

    if (dto.presetId) {
      presetData = this.presetService.getPreset(dto.presetId, projectId, dto.name);
      const generatedArtifacts = presetData.artifacts.map((artifact, index) => ({
        id: `${projectId}-preset-artifact-${index + 1}`,
        ...artifact,
        description:
          typeof artifact.description === "string" ? artifact.description.trim() || null : null,
        filePath: artifact.filePath ?? null,
        language: artifact.language ?? null,
        framework: artifact.framework ?? null,
      }));

      artifacts = generatedArtifacts;
      services = Object.keys(
        ((presetData.resolvedSpec as Record<string, any>)?.spec?.services as Record<
          string,
          unknown
        >) ?? {},
      ).length;
      databases = Object.keys(
        ((presetData.resolvedSpec as Record<string, any>)?.spec?.databases as Record<
          string,
          unknown
        >) ?? {},
      ).length;
      detectedStructure = presetData.structure
        ? { ...presetData.structure }
        : { ...DEFAULT_STRUCTURE };
    } else if (dto.path) {
      const analysis = await this.analyzePath(projectId, dto.name, dto.path);
      artifacts = analysis.artifacts;
      services = analysis.serviceCount;
      databases = analysis.databaseCount;
      detectedStructure = analysis.structure;
    }

    if (!detectedStructure) {
      detectedStructure = { ...DEFAULT_STRUCTURE };
    }

    const project = await db.createProject(projectId, dto.name, services, databases);

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

    if (presetData?.resolvedSpec) {
      const resolvedJson = JSON.stringify(presetData.resolvedSpec, null, 2);
      const specHash = createHash("sha1").update(resolvedJson).digest("hex");
      await db.createVersion(`version-${Date.now()}`, project.id, specHash, resolvedJson);
    }

    if (events?.broadcastToAll) {
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

    return {
      id: project.id,
      name: project.name,
      services,
      databases,
      artifacts: artifacts.length,
      structure: detectedStructure,
      presetResolvedSpec: presetData?.resolvedSpec,
    };
  }

  private async analyzePath(projectId: string, projectName: string, projectPath: string) {
    let files: string[] = [];
    let structure = undefined as any;
    let gitUrl: string | undefined;
    let branch: string | undefined;
    let contentFetcher: ContentFetcher | undefined;
    let cleanupNeeded = false;

    try {
      const resolved = gitScanner.resolveTempPath
        ? await gitScanner.resolveTempPath(projectPath)
        : null;
      if (resolved?.success) {
        files = resolved.files ?? [];
        structure = resolved.projectStructure;
        gitUrl = resolved.gitUrl;
        branch = resolved.branch;
        cleanupNeeded = true;

        if (gitUrl) {
          const parsedGit = parseGitUrl(gitUrl);
          if (parsedGit) {
            const ref = branch ?? parsedGit.ref ?? "main";
            const token = typeof process !== "undefined" ? process.env.GITHUB_TOKEN : undefined;
            contentFetcher = createGithubContentFetcher({
              owner: parsedGit.owner,
              repo: parsedGit.repo,
              ref,
              token,
            });
          }
        }
      }

      if (!files.length) {
        const scanResult = await gitScanner.scanLocalPath(projectPath);
        if (scanResult.success) {
          files = scanResult.files ?? [];
          structure = scanResult.projectStructure;
          contentFetcher = createLocalContentFetcher(projectPath);
          branch = scanResult.branch;
        }
      }

      let analysisArtifacts: any[] = [];
      let serviceCount = 0;
      let databaseCount = 0;
      if (files.length > 0) {
        const absoluteProjectRoot = projectPath ? path.resolve(projectPath) : undefined;
        const analysis = await analyzeProjectFiles(projectId, projectName, files, {
          gitUrl,
          structure,
          branch,
          fetcher: contentFetcher,
          projectRoot: absoluteProjectRoot,
        });

        analysisArtifacts = analysis.artifacts;
        serviceCount = analysis.serviceCount;
        databaseCount = analysis.databaseCount;
        structure = analysis.structure;

        if (absoluteProjectRoot) {
          const importerArtifacts = await this.runImporterPipeline(
            absoluteProjectRoot,
            projectName,
          );
          const existingArtifactNames = new Set(analysisArtifacts.map((a) => a.name));
          for (const inferredArtifact of importerArtifacts) {
            const artifact = inferredArtifact.artifact;
            const metadata = artifact.metadata || {};
            if (existingArtifactNames.has(artifact.name)) continue;
            existingArtifactNames.add(artifact.name);
            analysisArtifacts.push({
              id: artifact.id,
              name: artifact.name,
              type: artifact.type as string,
              description: artifact.description || null,
              language: (metadata.language as string) || null,
              framework: (metadata.framework as string) || null,
              metadata,
              filePath: (metadata.sourceFile as string) || null,
            });
            if (artifact.type === "service") {
              serviceCount++;
            } else if (artifact.type === "database") {
              databaseCount++;
            }
          }
        }
      }

      return {
        artifacts: analysisArtifacts,
        serviceCount,
        databaseCount,
        structure: structure ?? { ...DEFAULT_STRUCTURE },
      };
    } finally {
      if (cleanupNeeded && gitScanner.cleanupAll) {
        await gitScanner.cleanupAll();
      }
    }
  }

  private async runImporterPipeline(projectRoot: string, projectName: string) {
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
      return manifest.artifacts;
    } catch (error) {
      console.warn("[ProjectService] Importer pipeline failed:", error);
      return [];
    }
  }
}
