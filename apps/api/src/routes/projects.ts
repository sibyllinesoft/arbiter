import { ProjectEntities } from '@arbiter/shared/types/entities';
import { Hono } from 'hono';
import type { ContentFetcher } from '../content-fetcher';
import { createGithubContentFetcher, createLocalContentFetcher } from '../content-fetcher';
import { gitScanner } from '../git-scanner';
import { parseGitUrl } from '../git-url';
import { analyzeProjectFiles } from '../project-analysis';
type Dependencies = Record<string, unknown>;

export function createProjectsRouter(deps: Dependencies) {
  const router = new Hono();

  // GET single project with full resolved spec and artifacts
  router.get('/projects/:id', async c => {
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    try {
      const db = deps.db as any;

      // Fetch project details
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Fetch all artifacts for this project
      const artifacts = await db.getArtifacts(projectId);

      // Map artifacts to the expected spec structure for frontend rendering
      const services: Record<string, any> = {};
      const databases: Record<string, any> = {};
      const components: Record<string, any> = {};

      artifacts.forEach((artifact: any) => {
        const cleanName = artifact.name.replace(/_/g, '-');
        const baseData = {
          name: artifact.name,
          type: artifact.type,
          description: artifact.description || artifact.metadata?.description || '',
          metadata: {
            ...artifact.metadata,
            detected: true,
            language: artifact.language,
            framework: artifact.framework,
          },
        };

        switch (artifact.type) {
          case 'service':
            services[cleanName] = baseData;
            break;
          case 'database':
            databases[cleanName] = baseData;
            break;
          case 'module':
          case 'tool':
          case 'binary':
          case 'frontend':
          case 'job':
          case 'infrastructure':
          case 'deployment':
            components[cleanName] = baseData;
            break;
          default:
            // Handle other types as components
            components[cleanName] = baseData;
        }
      });

      // Calculate infrastructure and external counts for consistency
      let infrastructureCount = 0;
      let externalCount = 0;
      for (const [key, comp] of Object.entries(components)) {
        if (comp.type === 'infrastructure') {
          infrastructureCount++;
        } else if (!['module', 'tool', 'binary', 'frontend'].includes(comp.type)) {
          externalCount++;
        }
      }

      // Generate routes from services (for UI consistency)
      const routes = Object.keys(services).map(serviceName => ({
        id: serviceName,
        path: `/${serviceName}`,
        name: services[serviceName].name,
      }));

      const resolvedSpec = {
        version: '1.0',
        services,
        databases,
        components,
        routes,
        // Add placeholder flows and capabilities based on services
        flows:
          Object.keys(services).length > 0
            ? [{ id: 'main-flow', name: 'Main Application Flow' }]
            : [],
        capabilities:
          Object.keys(services).length > 0 ? [{ id: 'api-capability', name: 'API Services' }] : [],
        // Include raw artifacts for detailed rendering
        artifacts,
        project: {
          id: project.id,
          name: project.name,
          entities: {
            services: Object.keys(services).length,
            databases: Object.keys(databases).length,
            modules: Object.keys(components).filter(k => components[k].type === 'module').length,
            tools: Object.keys(components).filter(
              k => components[k].type === 'tool' || components[k].type === 'binary'
            ).length,
            frontends: Object.keys(components).filter(k => components[k].type === 'frontend')
              .length,
            infrastructure: infrastructureCount,
            external: externalCount,
            routes: routes.length,
            flows: Object.keys(services).length > 0 ? 1 : 0,
            capabilities: Object.keys(services).length > 0 ? 1 : 0,
          },
        },
      };

      return c.json({ resolved: resolvedSpec });
    } catch (error) {
      console.error('Error fetching project details:', error);
      return c.json({ error: 'Failed to fetch project details' }, 500);
    }
  });

  // Projects endpoint - using real database with entity counts
  router.get('/projects', async c => {
    console.log(
      '🔄 GET /api/projects - Request received from:',
      c.req.header('origin') || 'unknown'
    );
    try {
      const db = deps.db as any;
      const projects = await db.listProjects();
      console.log('📊 GET /api/projects - Raw projects from DB:', projects.length, 'projects');

      // Transform database projects and calculate entity counts from specs
      const formattedProjects = await Promise.all(
        projects.map(async (project: any) => {
          let entities: ProjectEntities = {
            services: 0,
            databases: 0,
            modules: 0,
            tools: 0,
            frontends: 0,
            infrastructure: 0,
            external: 0,
            // CUE spec entities
            routes: 0,
            flows: 0,
            capabilities: 0,
          };

          try {
            // Get real artifacts from database for entity calculation
            const artifacts = await db.getArtifacts(project.id);

            // Build services from real artifacts
            const services: Record<string, any> = {};
            const serviceArtifacts = artifacts.filter((a: any) => a.type === 'service');
            const routeSet = new Set<string>();

            const toSlug = (value: string) =>
              String(value || '')
                .replace(/[^a-z0-9]+/gi, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();

            for (const artifact of serviceArtifacts) {
              const serviceName = artifact.name.replace(/_/g, '-');
              services[serviceName] = {
                name: artifact.name,
                type: 'service',
                metadata: { detected: true },
              };

              const analysis = artifact.metadata?.tsoaAnalysis;
              if (analysis) {
                const rawServiceName = artifact.name.replace(/^@[^/]+\//, '') || artifact.name;
                const slugRoot = toSlug(artifact.name) || 'service';
                const serviceSlug = toSlug(rawServiceName) || slugRoot;
                const baseRoutePath = `/${serviceSlug}`.replace(/\/+/g, '/');
                if (baseRoutePath) {
                  routeSet.add(baseRoutePath);
                }

                const controllerCandidates = Array.isArray(analysis.controllerCandidates)
                  ? analysis.controllerCandidates
                  : [];

                controllerCandidates.forEach((candidate: string) => {
                  const normalized = candidate.split('\\').join('/');
                  const fileName = normalized.split('/').pop() || normalized;
                  const baseSegment = toSlug(
                    fileName
                      .replace(/\.[tj]sx?$/i, '')
                      .replace(/controller$/i, '')
                      .replace(/route$/i, '')
                  );
                  const routePath = baseSegment
                    ? `${baseRoutePath}/${baseSegment}`.replace(/\/+/g, '/')
                    : baseRoutePath;
                  routeSet.add(routePath);
                });
              }
            }

            // Build databases from real artifacts
            const databases: Record<string, any> = {};
            const databaseArtifacts = artifacts.filter((a: any) => a.type === 'database');

            for (const artifact of databaseArtifacts) {
              const dbName = artifact.name.replace(/_/g, '-');

              // Determine database type from artifact
              const getDatabaseType = (framework?: string, name?: string) => {
                if (framework) return framework.toLowerCase();
                if (name?.includes('postgres') || name?.includes('pg')) return 'postgresql';
                if (name?.includes('mysql') || name?.includes('maria')) return 'mysql';
                if (name?.includes('mongo')) return 'mongodb';
                if (name?.includes('redis')) return 'redis';
                if (name?.includes('sqlite')) return 'sqlite';
                return 'unknown';
              };

              databases[dbName] = {
                name: artifact.name,
                type: getDatabaseType(artifact.framework, artifact.name),
                metadata: {
                  detected: true,
                  language: artifact.language || 'sql',
                  framework: artifact.framework || 'unknown',
                },
              };
            }

            // Count other artifact types properly
            const otherArtifacts = artifacts.filter(
              (a: any) => !['service', 'database'].includes(a.type)
            );

            // Group artifacts by type for debugging
            const typeGroups: Record<string, number> = {};
            for (const artifact of otherArtifacts) {
              const type = artifact.type;
              typeGroups[type] = (typeGroups[type] || 0) + 1;
            }
            console.log(`[DEBUG] Artifact types for project ${project.name}:`, typeGroups);

            let moduleCount = 0;
            let toolCount = 0;
            let frontendCount = 0;
            let infrastructureCount = 0;
            let externalCount = 0;

            for (const artifact of otherArtifacts) {
              // Normalize types
              let type = artifact.type;
              if (type === 'binary') type = 'tool';

              switch (type) {
                case 'module':
                  moduleCount++;
                  break;
                case 'tool':
                  toolCount++;
                  break;
                case 'frontend':
                  frontendCount++;
                  break;
                case 'infrastructure':
                  infrastructureCount++;
                  break;
                default:
                  {
                    const detectedType = String(
                      artifact.metadata?.detectedType || artifact.metadata?.type || ''
                    ).toLowerCase();
                    if (detectedType === 'tool' || detectedType === 'build_tool') {
                      toolCount++;
                    } else if (detectedType === 'frontend') {
                      frontendCount++;
                    } else if (detectedType === 'infrastructure') {
                      infrastructureCount++;
                    } else {
                      externalCount++;
                    }
                  }
                  break;
              }
            }

            // Include frontend-detected routes
            const frontendRoutes: string[] = artifacts
              .filter((artifact: any) => artifact.metadata?.frontendAnalysis)
              .flatMap((artifact: any) => {
                const analysis = artifact.metadata?.frontendAnalysis;
                if (!analysis) return [] as string[];
                const packageRoutes = (analysis.routers || []).flatMap((router: any) =>
                  (router.routes || []).map((route: any) => String(route.path || ''))
                );
                return packageRoutes;
              });

            frontendRoutes
              .map((path: string) => String(path || '').trim())
              .filter(Boolean)
              .forEach((path: string) => {
                const normalized = path.startsWith('/') ? path : `/${path}`;
                routeSet.add(normalized.replace(/\/+/g, '/'));
              });

            const routes = Array.from(routeSet);

            // Calculate entity counts
            entities = {
              services: Object.keys(services).length,
              databases: Object.keys(databases).length,
              modules: moduleCount,
              tools: toolCount,
              frontends: frontendCount,
              infrastructure: infrastructureCount,
              external: externalCount,
              routes: routes.length,
              flows: routes.length > 0 ? 1 : 0, // Generate one flow if we have routes
              capabilities: routes.length > 0 ? 1 : 0, // Generate one capability if we have routes
            } as ProjectEntities;
          } catch (error) {
            console.warn(`Failed to calculate entities for project ${project.id}:`, error);
            // Fall back to basic database counts
            entities = {
              services: project.service_count || 0,
              databases: project.database_count || 0,
              modules: 0,
              tools: 0,
              frontends: 0,
              infrastructure: 0,
              external: 0,
              routes: 0,
              flows: 0,
              capabilities: 0,
            } as ProjectEntities;
          }

          return {
            id: project.id,
            name: project.name,
            status: 'active',
            entities,
            lastActivity: project.updated_at,
          };
        })
      );

      return c.json({ projects: formattedProjects });
    } catch (error) {
      console.error('Error fetching projects:', error);
      return c.json({ projects: [] });
    }
  });

  // Create project endpoint
  router.post('/projects', async c => {
    try {
      const db = deps.db as any;
      const body = await c.req.json();
      const { name, path: projectPath } = body;

      if (!name) {
        return c.json({ error: 'Project name is required' }, 400);
      }

      // Generate project ID
      const projectId = `project-${Date.now()}`;

      // Use the provided name (which should be extracted from git URL on frontend)
      let actualProjectName = name;

      let services = 0;
      let databases = 0;
      let artifacts: any[] = [];
      let detectedStructure: any;

      if (projectPath) {
        let files: string[] = [];
        let structure = undefined;
        let gitUrl: string | undefined;
        let branch: string | undefined;
        let contentFetcher: ContentFetcher | undefined;

        const resolved = gitScanner.resolveTempPath
          ? await gitScanner.resolveTempPath(projectPath)
          : null;

        if (resolved?.success) {
          files = resolved.files ?? [];
          structure = resolved.projectStructure;
          gitUrl = resolved.gitUrl;
          branch = resolved.branch;

          if (gitUrl) {
            const parsedGit = parseGitUrl(gitUrl);
            if (parsedGit) {
              const ref = branch ?? parsedGit.ref ?? 'main';
              const token = typeof process !== 'undefined' ? process.env.GITHUB_TOKEN : undefined;
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

        if (files.length > 0) {
          const analysis = await analyzeProjectFiles(projectId, actualProjectName, files, {
            gitUrl,
            structure,
            branch,
            fetcher: contentFetcher,
          });

          artifacts = analysis.artifacts;
          services = analysis.serviceCount;
          databases = analysis.databaseCount;
          detectedStructure = analysis.structure;
        }
      }

      // Create project with detected counts
      const project = await db.createProject(projectId, actualProjectName, services, databases);

      // Now create all the artifacts for the project
      for (const artifact of artifacts) {
        try {
          console.debug('[projects.create] storing artifact', {
            projectId,
            name: artifact.name,
            type: artifact.type,
            language: artifact.language,
            classification: artifact.metadata?.classification,
          });
          await db.createArtifact(
            artifact.id,
            projectId,
            artifact.name,
            artifact.type,
            artifact.language,
            artifact.framework,
            artifact.metadata,
            artifact.filePath
          );
        } catch (error) {
          console.warn(`Failed to create artifact ${artifact.name}:`, error);
        }
      }

      return c.json({
        id: project.id,
        name: project.name,
        status: 'active',
        services,
        databases,
        artifacts: artifacts.length,
        lastActivity: project.created_at,
        structure: detectedStructure,
      });
    } catch (error) {
      console.error('Error creating project:', error);
      return c.json({ error: 'Failed to create project' }, 500);
    }
  });

  // Delete project endpoint
  router.delete('/projects/:id', async c => {
    const projectId = c.req.param('id');

    if (!projectId) {
      return c.json({ error: 'Project ID is required' }, 400);
    }

    try {
      const db = deps.db as any;

      // Check if project exists
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Delete all related artifacts first
      await db.deleteArtifacts(projectId);

      // Delete the project
      await db.deleteProject(projectId);

      console.log(`🗑️ Project deleted: ${projectId} (${project.name})`);

      return c.json({
        success: true,
        message: `Project "${project.name}" deleted successfully`,
        projectId,
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      return c.json({ error: 'Failed to delete project' }, 500);
    }
  });

  // Action log endpoint for service activities
  router.get('/activities', c => {
    return c.json({
      activities: [
        {
          id: 'act-1',
          type: 'service',
          message: 'Service added: user-auth-service',
          timestamp: '2025-09-20T10:30:00Z',
          projectId: 'project-1',
        },
        {
          id: 'act-2',
          type: 'database',
          message: 'Database configured: postgres-main',
          timestamp: '2025-09-20T10:15:00Z',
          projectId: 'project-1',
        },
        {
          id: 'act-3',
          type: 'service',
          message: 'Service deployed to staging environment',
          timestamp: '2025-09-20T09:45:00Z',
          projectId: 'project-2',
        },
      ],
    });
  });

  return router;
}
