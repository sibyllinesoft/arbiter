import type { SpecWorkbenchDB } from "../db";
import type { EventService } from "../events";
import { ProjectService } from "../services/ProjectService";

type Dependencies = Record<string, unknown>;

export class ProjectsController {
  private db: SpecWorkbenchDB;
  private projectService: ProjectService;

  constructor(deps: Dependencies) {
    this.db = deps.db as SpecWorkbenchDB;
    this.projectService = new ProjectService({
      db: this.db,
      events: deps.events as EventService | undefined,
    });
  }

  async getProjectWithArtifacts(projectId: string) {
    const projects = await this.db.listProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      const err: any = new Error("Project not found");
      err.status = 404;
      throw err;
    }

    const artifacts = await this.db.getArtifacts(projectId);

    const services: Record<string, any> = {};
    const databases: Record<string, any> = {};
    const components: Record<string, any> = {};

    artifacts.forEach((artifact: any) => {
      const cleanName = artifact.name.replace(/_/g, "-");
      const baseData = {
        id: artifact.id,
        artifactId: artifact.id,
        name: artifact.name,
        type: artifact.type,
        description: artifact.description || artifact.metadata?.description || "",
        metadata: {
          ...(artifact.metadata ?? {}),
          detected: true,
          language: artifact.language,
          framework: artifact.framework,
          artifactId: artifact.id,
        },
      };

      switch (artifact.type) {
        case "service":
          services[cleanName] = baseData;
          break;
        case "database":
          databases[cleanName] = baseData;
          break;
        default:
          components[cleanName] = baseData;
      }
    });

    let infrastructureCount = 0;
    let externalCount = 0;
    for (const comp of Object.values(components)) {
      if (comp.type === "infrastructure") {
        infrastructureCount++;
      } else if (!["package", "tool", "binary", "frontend"].includes(comp.type)) {
        externalCount++;
      }
    }

    const routes = Object.keys(services).map((serviceName) => ({
      id: serviceName,
      path: `/${serviceName}`,
      name: services[serviceName].name,
    }));

    return {
      project,
      artifacts,
      services,
      databases,
      components,
      infrastructureCount,
      externalCount,
      routes,
    };
  }

  async createProject(dto: any) {
    return this.projectService.createProject(dto);
  }
}
