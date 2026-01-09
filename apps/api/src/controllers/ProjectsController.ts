import type { EventService } from "../io/events";
import { ProjectService } from "../services/ProjectService";
import type { SpecWorkbenchDB } from "../util/db";

type Dependencies = Record<string, unknown>;

/** Build base artifact data structure */
function buildArtifactData(artifact: any) {
  return {
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
}

/** Categorize artifacts into services, databases, and components */
function categorizeArtifacts(artifacts: any[]) {
  const services: Record<string, any> = {};
  const databases: Record<string, any> = {};
  const components: Record<string, any> = {};

  for (const artifact of artifacts) {
    const cleanName = artifact.name.replace(/_/g, "-");
    const data = buildArtifactData(artifact);

    if (artifact.type === "service") {
      services[cleanName] = data;
    } else if (artifact.type === "database") {
      databases[cleanName] = data;
    } else {
      components[cleanName] = data;
    }
  }

  return { services, databases, components };
}

/** Count infrastructure and external components */
function countComponentTypes(components: Record<string, any>) {
  let infrastructureCount = 0;
  let externalCount = 0;
  const nonExternalTypes = ["package", "tool", "binary", "frontend"];

  for (const comp of Object.values(components)) {
    if (comp.type === "infrastructure") {
      infrastructureCount++;
    } else if (!nonExternalTypes.includes(comp.type)) {
      externalCount++;
    }
  }

  return { infrastructureCount, externalCount };
}

/** Build routes from services */
function buildRoutesFromServices(services: Record<string, any>) {
  return Object.keys(services).map((serviceName) => ({
    id: serviceName,
    path: `/${serviceName}`,
    name: services[serviceName].name,
  }));
}

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
    const { services, databases, components } = categorizeArtifacts(artifacts);
    const { infrastructureCount, externalCount } = countComponentTypes(components);
    const routes = buildRoutesFromServices(services);

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
