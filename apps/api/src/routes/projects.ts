import path from 'path';
import { getAllPlugins } from '@arbiter/importer/plugins';
import { ScannerRunner } from '@arbiter/importer/scanner';
import fs from 'fs-extra';
import { Hono } from 'hono';
type Dependencies = Record<string, unknown>;

export function createProjectsRouter(deps: Dependencies) {
  const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

  const router = new Hono();

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
          let entities = {
            services: 0,
            databases: 0,
            libraries: 0,
            clis: 0,
            frontends: 0,
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

            for (const artifact of serviceArtifacts) {
              const serviceName = artifact.name.replace(/_/g, '-');
              services[serviceName] = {
                name: artifact.name,
                type: 'service',
                metadata: { detected: true },
              };
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

            let libraryCount = 0;
            let cliCount = 0;
            let frontendCount = 0;
            let externalCount = 0;

            for (const artifact of otherArtifacts) {
              // Normalize types
              let type = artifact.type;
              if (type === 'binary') type = 'cli';

              switch (type) {
                case 'library':
                  libraryCount++;
                  break;
                case 'cli':
                  cliCount++;
                  break;
                case 'frontend':
                  frontendCount++;
                  break;
                default:
                  externalCount++;
                  break;
              }
            }

            // Generate UI routes based on detected services (limit to 3)
            const routes = Object.keys(services)
              .slice(0, 3)
              .map((serviceName, index) => ({
                id: serviceName.replace('-service', '').replace('service-', ''),
                path: `/${serviceName.replace('-service', '').replace('service-', '')}`,
                name: services[serviceName].name,
              }));

            // Calculate entity counts
            entities = {
              services: Object.keys(services).length,
              databases: Object.keys(databases).length,
              libraries: libraryCount,
              clis: cliCount,
              frontends: frontendCount,
              external: externalCount,
              routes: routes.length,
              flows: routes.length > 0 ? 1 : 0, // Generate one flow if we have routes
              capabilities: routes.length > 0 ? 1 : 0, // Generate one capability if we have routes
            };
          } catch (error) {
            console.warn(`Failed to calculate entities for project ${project.id}:`, error);
            // Fall back to basic database counts
            entities = {
              services: project.service_count || 0,
              databases: project.database_count || 0,
              libraries: 0,
              clis: 0,
              frontends: 0,
              external: 0,
              routes: 0,
              flows: 0,
              capabilities: 0,
            };
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

      // Helper function to clean artifact names from temp directory patterns
      const getCleanArtifactName = (originalName: string): string => {
        // Detect temp directory patterns and replace with project name
        if (
          originalName.includes('arbiter-git-scan') ||
          originalName.includes('Arbiter Git Scan') ||
          /arbiter.*git.*scan.*\d+.*[a-z0-9]+/i.test(originalName) ||
          /^[a-zA-Z0-9_-]*\d{13}[a-zA-Z0-9_-]*$/i.test(originalName)
        ) {
          return actualProjectName;
        }
        return originalName;
      };

      // If path is provided, run proper brownfield detection using importer
      let services = 0;
      let databases = 0;
      let artifacts: any[] = [];

      if (projectPath) {
        try {
          // Use regular imports for HMR to work properly
          const plugins = getAllPlugins();
          console.log(
            '[SCANNER] Available plugins:',
            plugins.map(p => p.name())
          );
          console.log('[SCANNER] Project path:', projectPath);

          // Configure the scanner
          const scanner = new ScannerRunner({
            projectRoot: projectPath,
            projectName: actualProjectName, // Use the extracted project name instead of temp directory name
            ignorePatterns: [
              '**/target/**',
              '**/node_modules/**',
              '**/.git/**',
              '**/dist/**',
              '**/build/**',
            ],
            plugins,
            parseOptions: {
              deepAnalysis: false,
              targetLanguages: [],
              includeBinaries: false,
              patterns: {
                include: ['**/*'],
                exclude: [],
              },
              maxFileSize: 1024 * 1024, // 1MB
            },
          });

          // Run the scanner
          console.log('[SCANNER] Starting scan...');
          const result = await scanner.scan();
          console.log('[SCANNER] Scan complete, found', result.artifacts.length, 'artifacts');

          // Convert importer results to our artifact format
          for (const inferredArtifact of result.artifacts) {
            const artifact = inferredArtifact.artifact;

            artifacts.push({
              id: artifact.id,
              name: getCleanArtifactName(artifact.name),
              type: artifact.type,
              language: artifact.metadata?.language || null,
              framework: artifact.metadata?.framework || null,
              metadata: {
                ...artifact.metadata,
                confidence: inferredArtifact.confidence.overall,
                detected: true,
                provenance: inferredArtifact.provenance,
              },
              filePath: inferredArtifact.provenance.evidence[0] || '', // Use first evidence file
            });

            // Count services and databases
            if (artifact.type === 'service') {
              services++;
            } else if (artifact.type === 'database') {
              databases++;
            }
          }

          console.log(
            `[SCAN] Processed ${result.artifacts.length} artifacts: ${services} services, ${databases} databases`
          );
        } catch (error) {
          console.error('[ERROR] Enhanced brownfield detection failed:', error);
          console.error('[ERROR] Stack trace:', (error as any).stack);
          // Continue with empty project if brownfield detection fails
        }
      }

      // Create project with detected counts
      const project = await db.createProject(projectId, actualProjectName, services, databases);

      // Now create all the artifacts for the project
      for (const artifact of artifacts) {
        try {
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
