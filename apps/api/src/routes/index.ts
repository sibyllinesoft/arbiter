import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import { Hono } from 'hono';
import { gitScanner } from '../git-scanner';
import { tunnelService } from '../tunnel-service';

export type Dependencies = Record<string, unknown>;

interface SearchResult {
  title: string;
  type: string;
  path: string;
  content: string;
  relevance: number;
}

async function searchFiles(
  query: string,
  searchType: string,
  limit: number
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  // Define search patterns based on type
  const searchPatterns: Record<string, string[]> = {
    all: ['**/*.md', '**/*.ts', '**/*.js', '**/*.cue', '**/*.json', '**/*.yaml', '**/*.yml'],
    specs: ['**/*.cue', '**/spec/**/*', '**/specs/**/*'],
    handlers: ['**/handlers/**/*', '**/webhooks/**/*'],
    docs: ['**/*.md', '**/docs/**/*', '**/README*'],
    webhooks: ['**/webhooks/**/*', '**/webhook/**/*', '**/handlers/**/*'],
  };

  const patterns = searchPatterns[searchType] || searchPatterns.all;

  try {
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: '/home/nathan/Projects/arbiter',
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
        absolute: true,
      });

      for (const filePath of files) {
        try {
          if (!(await fs.pathExists(filePath))) continue;

          const stat = await fs.stat(filePath);
          if (!stat.isFile() || stat.size > 100000) continue; // Skip large files

          const content = await fs.readFile(filePath, 'utf-8');
          const contentLower = content.toLowerCase();

          // Calculate relevance score
          let relevance = 0;
          const lines = content.split('\n');
          const matchingLines: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();

            if (lineLower.includes(queryLower)) {
              relevance++;
              matchingLines.push(`${i + 1}: ${line.trim()}`);

              // Boost relevance for title/heading matches
              if (
                line.trim().startsWith('#') ||
                line.includes('title:') ||
                line.includes('name:')
              ) {
                relevance += 3;
              }
            }
          }

          if (relevance > 0) {
            const relativePath = path.relative('/home/nathan/Projects/arbiter', filePath);
            const fileType = path.extname(filePath).slice(1) || 'file';

            results.push({
              title: path.basename(filePath),
              type: fileType,
              path: relativePath,
              content: matchingLines.slice(0, 5).join('\n'), // First 5 matching lines
              relevance,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }

    // Sort by relevance and limit results
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

export function createApiRouter(deps: Dependencies) {
  const app = new Hono();

  app.get('/health', c =>
    c.json({ status: 'healthy', timestamp: new Date().toISOString(), database: true })
  );

  app.post('/api/validate', async c => {
    return c.json({ success: true, spec_hash: 'stubbed', resolved: {} });
  });

  // Search endpoint for MCP
  app.post('/api/search', async c => {
    try {
      const body = await c.req.json();
      const { query, type = 'all', limit = 10 } = body;

      if (!query || typeof query !== 'string') {
        return c.json({ error: 'Query parameter is required' }, 400);
      }

      const results = await searchFiles(query, type, limit);

      return c.json({
        success: true,
        query,
        type,
        total: results.length,
        results,
      });
    } catch (error) {
      console.error('Search API error:', error);
      return c.json(
        {
          success: false,
          error: 'Search failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Fetch endpoint for MCP
  app.post('/api/fetch', async c => {
    try {
      const body = await c.req.json();
      const { path: filePath, encoding = 'utf-8' } = body;

      if (!filePath || typeof filePath !== 'string') {
        return c.json(
          {
            success: false,
            error: 'Path parameter is required',
          },
          400
        );
      }

      // Normalize the path - remove leading slash if present
      const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const fullPath = path.resolve('/home/nathan/Projects/arbiter', normalizedPath);

      // Security check - ensure the path is within the project directory
      if (!fullPath.startsWith('/home/nathan/Projects/arbiter/')) {
        return c.json(
          {
            success: false,
            error: 'Access denied: Path outside project directory',
          },
          403
        );
      }

      // Check if file exists
      if (!(await fs.pathExists(fullPath))) {
        return c.json(
          {
            success: false,
            error: 'File not found',
          },
          404
        );
      }

      const stat = await fs.stat(fullPath);

      // Check if it's a file
      if (!stat.isFile()) {
        return c.json(
          {
            success: false,
            error: 'Path is not a file',
          },
          400
        );
      }

      // Check file size (limit to 1MB for safety)
      if (stat.size > 1024 * 1024) {
        return c.json(
          {
            success: false,
            error: 'File too large (limit: 1MB)',
          },
          400
        );
      }

      let content: string;
      const fileType = path.extname(fullPath).slice(1) || 'file';

      if (encoding === 'base64') {
        const buffer = await fs.readFile(fullPath);
        content = buffer.toString('base64');
      } else {
        content = await fs.readFile(fullPath, 'utf-8');
      }

      return c.json({
        success: true,
        path: filePath,
        encoding,
        content,
        size: stat.size,
        type: fileType,
        lastModified: stat.mtime.toISOString(),
      });
    } catch (error) {
      console.error('Fetch API error:', error);
      return c.json(
        {
          success: false,
          error: 'Fetch failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Add endpoint for MCP add commands
  app.post('/api/add', async c => {
    try {
      const body = await c.req.json();
      const { subcommand, name, options = {} } = body;

      if (!subcommand || !name) {
        return c.json(
          {
            success: false,
            error: 'subcommand and name parameters are required',
          },
          400
        );
      }

      // Import the addCommand function
      const { addCommand } = await import(
        '/home/nathan/Projects/arbiter/packages/cli/src/commands/add.js'
      );

      // Create a basic CLI config (you may want to make this configurable)
      const config = {
        apiUrl: 'http://localhost:5050',
        timeout: 30000,
        format: 'json' as const,
        color: false,
        projectDir: process.cwd(),
      };

      // Call the add command
      const exitCode = await addCommand(subcommand, name, options, config);

      if (exitCode === 0) {
        return c.json({
          success: true,
          message: `Successfully added ${subcommand}: ${name}`,
          subcommand,
          name,
          options,
        });
      } else {
        return c.json(
          {
            success: false,
            error: `Add command failed with exit code ${exitCode}`,
            subcommand,
            name,
          },
          500
        );
      }
    } catch (error) {
      console.error('Add API error:', error);
      return c.json(
        {
          success: false,
          error: 'Add command failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Create endpoint for MCP create project command
  app.post('/api/create', async c => {
    try {
      const body = await c.req.json();
      const { name, options = {} } = body;

      if (!name) {
        return c.json(
          {
            success: false,
            error: 'name parameter is required',
          },
          400
        );
      }

      // Import the initCommand function
      const { initCommand } = await import(
        '/home/nathan/Projects/arbiter/packages/cli/src/commands/init.js'
      );

      // Determine target directory
      const targetDir = options.directory
        ? path.resolve(options.directory, name)
        : path.resolve(process.cwd(), name);

      // Prepare init options
      const initOptions = {
        template: options.template || 'basic',
        force: options.force || false,
        ...options,
      };

      // Change to target directory for project creation
      const originalCwd = process.cwd();

      try {
        // Ensure parent directory exists
        await fs.ensureDir(path.dirname(targetDir));

        // Create and change to target directory
        await fs.ensureDir(targetDir);
        process.chdir(targetDir);

        // Call the init command
        const exitCode = await initCommand(name, initOptions);

        if (exitCode === 0) {
          return c.json({
            success: true,
            message: `Successfully created project: ${name}`,
            name,
            directory: targetDir,
            template: initOptions.template,
            options: initOptions,
          });
        } else {
          return c.json(
            {
              success: false,
              error: `Init command failed with exit code ${exitCode}`,
              name,
              directory: targetDir,
            },
            500
          );
        }
      } finally {
        // Always restore original working directory
        process.chdir(originalCwd);
      }
    } catch (error) {
      console.error('Create API error:', error);
      return c.json(
        {
          success: false,
          error: 'Create project failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Projects endpoint - using real database with entity counts
  app.get('/api/projects', async c => {
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
            components: 0,
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
                type: 'deployment',
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

            // Build components from other artifacts
            const components: Record<string, any> = {};
            const otherArtifacts = artifacts.filter(
              (a: any) => !['service', 'database'].includes(a.type)
            );

            for (const artifact of otherArtifacts) {
              const componentName = artifact.name.replace(/_/g, '-');
              components[componentName] = {
                name: artifact.name,
                type: artifact.type,
                metadata: { detected: true },
              };
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
              components: Object.keys(components).length,
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
              components: 0,
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
  app.post('/api/projects', async c => {
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
          // Import the scanner and plugins from the importer package
          const { ScannerRunner } = await import('@arbiter/importer/scanner');
          const { dockerPlugin, rustPlugin, nodejsPlugin, configOnlyPlugin } = await import(
            '@arbiter/importer/plugins'
          );

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
            plugins: [dockerPlugin, rustPlugin, nodejsPlugin, configOnlyPlugin],
            maxFileSize: 1024 * 1024, // 1MB
          });

          // Run the scanner
          const result = await scanner.scan();

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
          console.warn('Enhanced brownfield detection failed, creating empty project:', error);
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
  app.delete('/api/projects/:id', async c => {
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
  app.get('/api/activities', c => {
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
          type: 'deployment',
          message: 'Deployed to staging environment',
          timestamp: '2025-09-20T09:45:00Z',
          projectId: 'project-2',
        },
      ],
    });
  });

  // Specifications endpoint for CLI
  app.get('/api/specifications', async c => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    try {
      console.log(`[SPECS-GET] ${requestId} - Request started at ${new Date().toISOString()}`);

      const query = c.req.query();
      const { type, path: specPath } = query;
      console.log(`[SPECS-GET] ${requestId} - Query params:`, { type, path: specPath });

      if (specPath && (await fs.pathExists(specPath))) {
        console.log(`[SPECS-GET] ${requestId} - File exists, reading content...`);
        const content = await fs.readFile(specPath, 'utf-8');
        const stat = await fs.stat(specPath);
        const duration = Date.now() - startTime;

        console.log(`[SPECS-GET] ${requestId} - Success after ${duration}ms`);

        return c.json({
          success: true,
          type,
          path: specPath,
          content,
          lastModified: stat.mtime.toISOString(),
        });
      }

      const duration = Date.now() - startTime;
      console.log(`[SPECS-GET] ${requestId} - File not found after ${duration}ms`);

      return c.json(
        {
          success: false,
          error: 'Specification not found',
          type,
          path: specPath,
        },
        404
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[SPECS-GET] ${requestId} - Error after ${duration}ms:`, error);

      return c.json(
        {
          success: false,
          error: 'Failed to retrieve specification',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.post('/api/specifications', async c => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    try {
      console.log(`[SPECS-POST] ${requestId} - Request started at ${new Date().toISOString()}`);

      const body = await c.req.json();
      const { type, path: specPath, content } = body;
      console.log(`[SPECS-POST] ${requestId} - Body params:`, {
        type,
        path: specPath,
        contentLength: content?.length || 0,
      });

      if (!specPath || !content) {
        const duration = Date.now() - startTime;
        console.log(
          `[SPECS-POST] ${requestId} - Bad request after ${duration}ms - missing path or content`
        );

        return c.json(
          {
            success: false,
            error: 'path and content are required',
          },
          400
        );
      }

      console.log(`[SPECS-POST] ${requestId} - Ensuring directory exists...`);
      // Ensure directory exists
      await fs.ensureDir(path.dirname(specPath));

      console.log(`[SPECS-POST] ${requestId} - Writing file...`);
      // Write the specification file
      await fs.writeFile(specPath, content, 'utf-8');

      const duration = Date.now() - startTime;
      console.log(`[SPECS-POST] ${requestId} - Success after ${duration}ms`);

      return c.json({
        success: true,
        type,
        path: specPath,
        message: 'Specification created successfully',
        lastModified: new Date().toISOString(),
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[SPECS-POST] ${requestId} - Error after ${duration}ms:`, error);

      return c.json(
        {
          success: false,
          error: 'Failed to create specification',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Handler endpoints that integrate with the existing HandlerAPIController
  // Order matters! More specific routes must come before parameterized routes

  // Handler management endpoints (non-parameterized routes first)
  app.get('/api/handlers/executions', async c => {
    const query = c.req.query();
    const request = {
      handlerId: query.handlerId,
      projectId: query.projectId,
      provider: query.provider as 'github' | 'gitlab' | undefined,
      event: query.event,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    };
    const response = await (deps.handlersApi as any).getExecutionHistory(request);
    return c.json(response);
  });

  app.get('/api/handlers/stats', async c => {
    const response = await (deps.handlersApi as any).getHandlerStats();
    return c.json(response);
  });

  app.post('/api/handlers/validate', async c => {
    const { filePath } = await c.req.json();
    const response = await (deps.handlersApi as any).validateHandler({ filePath });
    return c.json(response);
  });

  app.post('/api/handlers/init', async c => {
    const response = await (deps.handlersApi as any).initializeHandlerStructure();
    return c.json(response);
  });

  // Generic handlers list and CRUD operations
  app.get('/api/handlers', async c => {
    const query = c.req.query();
    const request = {
      provider: query.provider as 'github' | 'gitlab' | undefined,
      event: query.event,
      enabled: query.enabled ? query.enabled === 'true' : undefined,
    };
    const response = await (deps.handlersApi as any).listHandlers(request);
    return c.json(response);
  });

  app.post('/api/handlers', async c => {
    const request = await c.req.json();
    const response = await (deps.handlersApi as any).createHandler(request);
    return c.json(response);
  });

  // Parameterized routes (must come after non-parameterized routes)
  app.get('/api/handlers/:id', async c => {
    const id = c.req.param('id');
    const response = await (deps.handlersApi as any).getHandler({ id });
    return c.json(response);
  });

  app.put('/api/handlers/:id', async c => {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const response = await (deps.handlersApi as any).updateHandler({ id, updates });
    return c.json(response);
  });

  app.delete('/api/handlers/:id', async c => {
    const id = c.req.param('id');
    const response = await (deps.handlersApi as any).removeHandler({ id });
    return c.json(response);
  });

  app.post('/api/handlers/:id/toggle', async c => {
    const id = c.req.param('id');
    const { enabled } = await c.req.json();
    const response = await (deps.handlersApi as any).toggleHandler({ id, enabled });
    return c.json(response);
  });

  app.post('/api/handlers/:id/reload', async c => {
    const id = c.req.param('id');
    const response = await (deps.handlersApi as any).reloadHandler({ id });
    return c.json(response);
  });

  // Webhook automation endpoints
  app.post('/api/webhooks/github/setup', async c => {
    const { repoOwner, repoName, events, tunnelUrl } = await c.req.json();

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      // Create webhook on GitHub
      const webhookUrl =
        tunnelUrl || process.env.TUNNEL_URL || 'https://your-tunnel.cfargotunnel.com';
      const webhookPayload = {
        name: 'web',
        active: true,
        events: events || ['push', 'pull_request'],
        config: {
          url: `${webhookUrl}/webhooks/github`,
          content_type: 'json',
          secret: process.env.GITHUB_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET,
          insecure_ssl: '0',
        },
      };

      const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/hooks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
            details: errorData,
          },
          response.status
        );
      }

      const webhookData = await response.json();

      return c.json({
        success: true,
        webhook: {
          id: webhookData.id,
          url: webhookData.config.url,
          events: webhookData.events,
          active: webhookData.active,
          created_at: webhookData.created_at,
          updated_at: webhookData.updated_at,
        },
        message: `Webhook created successfully for ${repoOwner}/${repoName}`,
      });
    } catch (error) {
      console.error('Failed to create GitHub webhook:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to create webhook',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.get('/api/webhooks/github/list/:owner/:repo', async c => {
    const owner = c.req.param('owner');
    const repo = c.req.param('repo');

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          response.status
        );
      }

      const webhooks = await response.json();

      return c.json({
        success: true,
        webhooks: webhooks.map((hook: any) => ({
          id: hook.id,
          name: hook.name,
          url: hook.config?.url,
          events: hook.events,
          active: hook.active,
          created_at: hook.created_at,
          updated_at: hook.updated_at,
        })),
      });
    } catch (error) {
      console.error('Failed to list GitHub webhooks:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to list webhooks',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.delete('/api/webhooks/github/:owner/:repo/:hookId', async c => {
    const owner = c.req.param('owner');
    const repo = c.req.param('repo');
    const hookId = c.req.param('hookId');

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          response.status
        );
      }

      return c.json({
        success: true,
        message: `Webhook ${hookId} deleted successfully from ${owner}/${repo}`,
      });
    } catch (error) {
      console.error('Failed to delete GitHub webhook:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to delete webhook',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Cloudflare tunnel management endpoints
  app.get('/api/tunnel/status', async c => {
    try {
      const status = tunnelService.getStatus();

      return c.json({
        success: true,
        tunnel: status,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to check tunnel status',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.post('/api/tunnel/start', async c => {
    try {
      const { mode, customConfig, tunnelName, domain } = await c.req.json().catch(() => ({}));
      const config = {
        mode: mode || 'webhook-only',
        customConfig,
        port: 5050,
        tunnelName,
        domain,
      };

      const status = await tunnelService.startTunnel(config);

      return c.json({
        success: true,
        tunnel: status,
        message: 'Tunnel started successfully',
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to start tunnel',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.post('/api/tunnel/stop', async c => {
    try {
      const status = await tunnelService.stopTunnel();

      return c.json({
        success: true,
        tunnel: status,
        message: 'Tunnel stopped successfully',
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to stop tunnel',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.get('/api/tunnel/logs', async c => {
    try {
      const logs = tunnelService.getLogs();

      return c.json({
        success: true,
        logs: logs,
        error: null,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to get tunnel logs',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Named tunnel management endpoints
  app.get('/api/tunnel/list', async c => {
    try {
      const tunnels = await tunnelService.listTunnels();

      return c.json({
        success: true,
        tunnels: tunnels,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to list tunnels',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.post('/api/tunnel/create', async c => {
    try {
      const { name } = await c.req.json().catch(() => ({}));
      const tunnelId = await tunnelService.createTunnel(name);

      return c.json({
        success: true,
        tunnelId: tunnelId,
        name: name || 'arbiter-dev',
        message: 'Tunnel created successfully',
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to create tunnel',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.delete('/api/tunnel/:nameOrId', async c => {
    try {
      const nameOrId = c.req.param('nameOrId');
      await tunnelService.deleteTunnel(nameOrId);

      return c.json({
        success: true,
        message: 'Tunnel deleted successfully',
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to delete tunnel',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.get('/api/tunnel/url', async c => {
    try {
      const url = tunnelService.getTunnelUrl();

      return c.json({
        success: true,
        url: url,
        isRunning: tunnelService.isHealthy(),
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: 'Failed to get tunnel URL',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Missing endpoints that the frontend expects
  app.get('/api/resolved', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    try {
      // Get project from database to fetch real brownfield detection data
      const db = deps.db as any;
      const projects = await db.listProjects();
      const project = projects.find((p: any) => p.id === projectId);

      if (!project) {
        return c.json({ error: 'Project not found' }, 404);
      }

      // Get real artifacts from database
      const artifacts = await db.getArtifacts(projectId);

      // Use the project name for cleaning artifact names
      const actualProjectName = project.name;

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

      // Build services from real artifacts
      const services: Record<string, any> = {};
      const serviceArtifacts = artifacts.filter((a: any) => a.type === 'service');

      for (const artifact of serviceArtifacts) {
        const serviceName = artifact.name.replace(/_/g, '-');

        // Determine image based on language/framework
        const getContainerImage = (language: string, framework?: string) => {
          switch (language?.toLowerCase()) {
            case 'rust':
              return 'rust:alpine';
            case 'nodejs':
            case 'javascript':
            case 'typescript':
              return 'node:alpine';
            case 'python':
              return 'python:slim';
            case 'go':
              return 'golang:alpine';
            case 'java':
              return 'openjdk:slim';
            default:
              return 'alpine:latest';
          }
        };

        // Determine default port based on framework
        const getDefaultPort = (language: string, framework?: string) => {
          if (framework?.includes('express') || framework?.includes('fastify')) return 3000;
          if (framework?.includes('flask') || framework?.includes('fastapi')) return 5000;
          if (framework?.includes('axum') || framework?.includes('warp')) return 8080;
          if (framework?.includes('gin') || framework?.includes('echo')) return 8080;
          if (language?.toLowerCase() === 'nodejs') return 3000;
          if (language?.toLowerCase() === 'python') return 5000;
          if (language?.toLowerCase() === 'rust') return 8080;
          if (language?.toLowerCase() === 'go') return 8080;
          return 8080; // fallback
        };

        const language = artifact.language || 'unknown';
        const framework = artifact.framework || 'unknown';
        const port = artifact.metadata?.port || getDefaultPort(language, framework);

        // Use actual container image if available, otherwise fall back to generated one
        const actualImage = artifact.metadata?.containerImage;
        const imageToUse = actualImage || getContainerImage(language, framework);

        services[serviceName] = {
          name: getCleanArtifactName(artifact.name)
            .split(/[-_]/)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          type: 'deployment',
          image: imageToUse,
          ports: [{ port, targetPort: port }],
          metadata: {
            language,
            framework,
            workspaceMember: artifact.metadata?.workspaceMember,
            filePath: artifact.file_path,
            detected: true,
            originalImage: actualImage, // Keep track of original detected image
            buildContext: artifact.metadata?.buildContext,
            dockerfile: artifact.metadata?.dockerfile,
          },
        };
      }

      // Build databases from real artifacts
      const databases: Record<string, any> = {};
      const databaseArtifacts = artifacts.filter((a: any) => a.type === 'database');

      for (const artifact of databaseArtifacts) {
        const dbName = artifact.name.replace(/_/g, '-');

        // Determine database type from artifact or framework
        const getDatabaseType = (framework?: string, name?: string) => {
          if (framework) return framework.toLowerCase();
          if (name?.includes('postgres') || name?.includes('pg')) return 'postgresql';
          if (name?.includes('mysql') || name?.includes('maria')) return 'mysql';
          if (name?.includes('mongo')) return 'mongodb';
          if (name?.includes('redis')) return 'redis';
          if (name?.includes('sqlite')) return 'sqlite';
          return 'postgresql'; // fallback
        };

        // Determine version based on database type
        const getDatabaseVersion = (dbType: string, explicitVersion?: string) => {
          if (explicitVersion) return explicitVersion;
          switch (dbType) {
            case 'postgresql':
              return '15';
            case 'mysql':
              return '8.0';
            case 'mongodb':
              return '7.0';
            case 'redis':
              return '7.2';
            case 'sqlite':
              return '3';
            default:
              return 'latest';
          }
        };

        const dbType = getDatabaseType(artifact.framework, artifact.name);
        const version = getDatabaseVersion(dbType, artifact.metadata?.version);

        databases[dbName] = {
          name: getCleanArtifactName(artifact.name)
            .split(/[-_]/)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          type: dbType,
          version,
          metadata: {
            configFile: artifact.metadata?.configFile,
            detected: true,
            language: artifact.language || 'sql',
            framework: artifact.framework || dbType,
          },
        };
      }

      // Build other artifacts (clients, tools, libraries)
      const components: Record<string, any> = {};
      const otherArtifacts = artifacts.filter(
        (a: any) => !['service', 'database'].includes(a.type)
      );

      for (const artifact of otherArtifacts) {
        const componentName = artifact.name.replace(/_/g, '-');

        const language = artifact.language || 'unknown';
        const framework = artifact.framework || 'unknown';

        components[componentName] = {
          name: getCleanArtifactName(artifact.name)
            .split(/[-_]/)
            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          type: artifact.type,
          language,
          framework,
          metadata: {
            workspaceMember: artifact.metadata?.workspaceMember,
            filePath: artifact.file_path,
            detected: true,
          },
        };
      }

      // Generate UI routes based on detected services
      const routes = Object.keys(services)
        .slice(0, 3)
        .map((serviceName, index) => ({
          id: serviceName.replace('-service', '').replace('service-', ''),
          path: `/${serviceName.replace('-service', '').replace('service-', '')}`,
          name: services[serviceName].name,
          component: `${serviceName.replace('-service', '').replace('service-', '').charAt(0).toUpperCase() + serviceName.replace('-service', '').replace('service-', '').slice(1)}Page`,
          capabilities: ['read-data'],
        }));

      return c.json({
        success: true,
        projectId,
        resolved: {
          apiVersion: 'v2',
          kind: 'Application',
          metadata: {
            name: project.name,
            version: project.version || '1.0.0',
            brownfield: true,
            detectedServices: serviceArtifacts.length,
            detectedDatabases: databaseArtifacts.length,
            totalArtifacts: artifacts.length,
          },
          spec: {
            services,
            databases,
            components,
            ui: {
              routes,
            },
            flows: [
              {
                id: 'service-flow',
                name: 'Service Integration Flow',
                steps: [{ visit: '/' }, { expect_api: { method: 'GET', path: '/health' } }],
              },
            ],
            capabilities: {
              'read-data': {
                name: 'Read Data',
                description: 'Capability to read application data',
              },
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching resolved spec:', error);
      return c.json({ error: 'Failed to fetch project specification' }, 500);
    }
  });

  app.get('/api/ir/flow', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    // Mock intermediate representation flow data
    return c.json({
      success: true,
      projectId,
      flows: [
        {
          id: 'user-registration',
          name: 'User Registration',
          description: 'New user sign-up process',
          nodes: [
            {
              id: 'start',
              type: 'start',
              position: { x: 0, y: 0 },
              data: { label: 'Start Registration' },
            },
            {
              id: 'form',
              type: 'form',
              position: { x: 200, y: 0 },
              data: { label: 'Registration Form', fields: ['email', 'password', 'name'] },
            },
            {
              id: 'validate',
              type: 'decision',
              position: { x: 400, y: 0 },
              data: { label: 'Validate Input' },
            },
            {
              id: 'create-user',
              type: 'action',
              position: { x: 600, y: 0 },
              data: { label: 'Create User Account' },
            },
            {
              id: 'send-email',
              type: 'action',
              position: { x: 800, y: 0 },
              data: { label: 'Send Welcome Email' },
            },
            {
              id: 'success',
              type: 'end',
              position: { x: 1000, y: 0 },
              data: { label: 'Registration Complete' },
            },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'form' },
            { id: 'e2', source: 'form', target: 'validate' },
            { id: 'e3', source: 'validate', target: 'create-user', data: { label: 'Valid' } },
            { id: 'e4', source: 'create-user', target: 'send-email' },
            { id: 'e5', source: 'send-email', target: 'success' },
            { id: 'e6', source: 'validate', target: 'form', data: { label: 'Invalid' } },
          ],
        },
        {
          id: 'user-login',
          name: 'User Login',
          description: 'User authentication process',
          nodes: [
            {
              id: 'start',
              type: 'start',
              position: { x: 0, y: 100 },
              data: { label: 'Start Login' },
            },
            {
              id: 'credentials',
              type: 'form',
              position: { x: 200, y: 100 },
              data: { label: 'Enter Credentials', fields: ['email', 'password'] },
            },
            {
              id: 'authenticate',
              type: 'action',
              position: { x: 400, y: 100 },
              data: { label: 'Authenticate User' },
            },
            {
              id: 'success',
              type: 'end',
              position: { x: 600, y: 100 },
              data: { label: 'Login Successful' },
            },
          ],
          edges: [
            { id: 'e1', source: 'start', target: 'credentials' },
            { id: 'e2', source: 'credentials', target: 'authenticate' },
            { id: 'e3', source: 'authenticate', target: 'success' },
          ],
        },
      ],
    });
  });

  app.get('/api/ir/site', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    // Mock site DAG data
    return c.json({
      success: true,
      projectId,
      site: {
        id: 'main-site',
        name: 'Application Site Map',
        description: 'Complete site architecture and page relationships',
        pages: [
          {
            id: 'home',
            path: '/',
            name: 'Home Page',
            component: 'HomePage',
            dependencies: ['auth', 'api'],
            children: ['dashboard', 'profile'],
          },
          {
            id: 'dashboard',
            path: '/dashboard',
            name: 'User Dashboard',
            component: 'Dashboard',
            dependencies: ['auth', 'api', 'charts'],
            parent: 'home',
          },
          {
            id: 'profile',
            path: '/profile',
            name: 'User Profile',
            component: 'Profile',
            dependencies: ['auth', 'api'],
            parent: 'home',
          },
        ],
        dependencies: [
          { id: 'auth', name: 'Authentication Service', type: 'service' },
          { id: 'api', name: 'REST API', type: 'api' },
          { id: 'charts', name: 'Chart Library', type: 'library' },
        ],
      },
    });
  });

  app.get('/api/ir/fsm', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    // Mock FSM (Finite State Machine) data
    return c.json({
      success: true,
      projectId,
      fsm: {
        id: 'user-state-machine',
        name: 'User Authentication FSM',
        description: 'State transitions for user authentication flow',
        initialState: 'logged_out',
        states: [
          {
            id: 'logged_out',
            name: 'Logged Out',
            type: 'initial',
            transitions: ['logging_in'],
          },
          {
            id: 'logging_in',
            name: 'Logging In',
            type: 'transition',
            transitions: ['logged_in', 'login_failed'],
          },
          {
            id: 'logged_in',
            name: 'Logged In',
            type: 'active',
            transitions: ['logging_out', 'session_expired'],
          },
          {
            id: 'login_failed',
            name: 'Login Failed',
            type: 'error',
            transitions: ['logged_out', 'logging_in'],
          },
          {
            id: 'logging_out',
            name: 'Logging Out',
            type: 'transition',
            transitions: ['logged_out'],
          },
          {
            id: 'session_expired',
            name: 'Session Expired',
            type: 'error',
            transitions: ['logged_out'],
          },
        ],
        transitions: [
          { from: 'logged_out', to: 'logging_in', trigger: 'login_attempt' },
          { from: 'logging_in', to: 'logged_in', trigger: 'login_success' },
          { from: 'logging_in', to: 'login_failed', trigger: 'login_failure' },
          { from: 'login_failed', to: 'logging_in', trigger: 'retry_login' },
          { from: 'login_failed', to: 'logged_out', trigger: 'cancel_login' },
          { from: 'logged_in', to: 'logging_out', trigger: 'logout_request' },
          { from: 'logged_in', to: 'session_expired', trigger: 'session_timeout' },
          { from: 'logging_out', to: 'logged_out', trigger: 'logout_complete' },
          { from: 'session_expired', to: 'logged_out', trigger: 'session_cleanup' },
        ],
      },
    });
  });

  app.get('/api/ir/view', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    // Mock view wireframes data
    return c.json({
      success: true,
      projectId,
      views: [
        {
          id: 'login-view',
          name: 'Login View',
          type: 'page',
          description: 'User authentication interface',
          components: [
            {
              id: 'header',
              type: 'header',
              position: { x: 0, y: 0, width: 100, height: 10 },
              content: 'Application Logo',
            },
            {
              id: 'login-form',
              type: 'form',
              position: { x: 20, y: 30, width: 60, height: 40 },
              content: 'Email/Password Form',
              fields: ['email', 'password'],
              actions: ['login', 'forgot-password'],
            },
            {
              id: 'footer',
              type: 'footer',
              position: { x: 0, y: 90, width: 100, height: 10 },
              content: 'Copyright & Links',
            },
          ],
        },
        {
          id: 'dashboard-view',
          name: 'Dashboard View',
          type: 'page',
          description: 'Main application dashboard',
          components: [
            {
              id: 'nav',
              type: 'navigation',
              position: { x: 0, y: 0, width: 100, height: 15 },
              content: 'Main Navigation',
            },
            {
              id: 'sidebar',
              type: 'sidebar',
              position: { x: 0, y: 15, width: 20, height: 75 },
              content: 'Menu & Tools',
            },
            {
              id: 'main-content',
              type: 'content',
              position: { x: 20, y: 15, width: 80, height: 75 },
              content: 'Dashboard Widgets',
            },
            {
              id: 'status-bar',
              type: 'status',
              position: { x: 0, y: 90, width: 100, height: 10 },
              content: 'Status Information',
            },
          ],
        },
      ],
    });
  });

  app.get('/api/gaps', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    // Mock gaps analysis data
    return c.json({
      success: true,
      projectId,
      gaps: {
        categories: [
          {
            id: 'security',
            name: 'Security',
            status: 'warning',
            items: [
              {
                id: 'auth-implementation',
                title: 'Authentication Implementation',
                description: 'User authentication system needs to be implemented',
                priority: 'high',
                status: 'missing',
                effort: 'medium',
                blockers: [],
              },
              {
                id: 'input-validation',
                title: 'Input Validation',
                description: 'All user inputs should be validated and sanitized',
                priority: 'high',
                status: 'partial',
                effort: 'low',
                blockers: [],
              },
            ],
          },
          {
            id: 'testing',
            name: 'Testing',
            status: 'error',
            items: [
              {
                id: 'unit-tests',
                title: 'Unit Test Coverage',
                description: 'Core business logic needs comprehensive unit tests',
                priority: 'medium',
                status: 'missing',
                effort: 'high',
                blockers: ['testing-framework-setup'],
              },
              {
                id: 'integration-tests',
                title: 'Integration Tests',
                description: 'API endpoints need integration test coverage',
                priority: 'medium',
                status: 'missing',
                effort: 'medium',
                blockers: ['unit-tests'],
              },
            ],
          },
          {
            id: 'performance',
            name: 'Performance',
            status: 'success',
            items: [
              {
                id: 'caching',
                title: 'Response Caching',
                description: 'Implement caching for frequently accessed data',
                priority: 'low',
                status: 'completed',
                effort: 'medium',
                blockers: [],
              },
              {
                id: 'database-optimization',
                title: 'Database Query Optimization',
                description: 'Optimize slow database queries and add indexes',
                priority: 'medium',
                status: 'in_progress',
                effort: 'medium',
                blockers: [],
              },
            ],
          },
          {
            id: 'documentation',
            name: 'Documentation',
            status: 'warning',
            items: [
              {
                id: 'api-docs',
                title: 'API Documentation',
                description: 'Complete API documentation with examples',
                priority: 'medium',
                status: 'partial',
                effort: 'low',
                blockers: [],
              },
              {
                id: 'user-guide',
                title: 'User Guide',
                description: 'Create comprehensive user guide and tutorials',
                priority: 'low',
                status: 'missing',
                effort: 'high',
                blockers: ['api-docs'],
              },
            ],
          },
        ],
        summary: {
          total: 7,
          completed: 1,
          in_progress: 1,
          missing: 4,
          partial: 1,
          high_priority: 2,
          medium_priority: 4,
          low_priority: 1,
        },
      },
    });
  });

  // Surface analysis endpoint - thin wrapper around CLI surface command
  app.post('/api/surface', async c => {
    try {
      const body = await c.req.json();
      const { targets = [], options = {} } = body;

      if (!targets.length) {
        return c.json(
          {
            success: false,
            error: 'targets parameter is required',
          },
          400
        );
      }

      // Import the CLI surface command directly
      const { surfaceCommand } = await import('@arbiter/cli/commands/surface');

      // Create a minimal config object
      const config = {
        apiUrl: 'http://localhost:5050',
        timeout: 30000,
        format: 'json' as const,
        color: false,
        projectDir: targets[0],
      };

      // Map API options to CLI surface options
      const surfaceOptions = {
        language: options.language ?? 'typescript', // Default language
        output: options.output,
        outputDir: options.outputDir,
        projectName: options.projectName,
        genericNames: options.genericNames ?? false,
        diff: options.diff ?? false,
        format: 'json' as const,
        ndjsonOutput: false,
        agentMode: true, // Use agent mode for API
        verbose: options.verbose ?? false,
      };

      // Change to the target directory for analysis
      const originalCwd = process.cwd();
      process.chdir(targets[0]);

      try {
        // Execute the CLI surface command
        const exitCode = await surfaceCommand(surfaceOptions, config);

        if (exitCode !== 0) {
          return c.json(
            {
              success: false,
              error: 'Surface analysis failed',
              message: `CLI command exited with code ${exitCode}`,
            },
            500
          );
        }

        // Return success - the CLI surface command handles its own output
        return c.json({
          success: true,
          targets,
          message: 'Surface analysis completed successfully',
          note: 'Results written to surface file in project directory',
        });
      } finally {
        // Restore original working directory
        process.chdir(originalCwd);
      }
    } catch (error) {
      console.error('Surface analysis error:', error);
      return c.json(
        {
          success: false,
          error: 'Surface analysis failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // Git import endpoints
  app.post('/api/import/scan-git', async c => {
    try {
      const { gitUrl } = await c.req.json();

      if (!gitUrl) {
        return c.json(
          {
            success: false,
            error: 'Git URL is required',
          },
          400
        );
      }

      const result = await gitScanner.scanGitUrl(gitUrl);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400
        );
      }

      return c.json({
        success: true,
        tempPath: result.tempPath,
        files: result.files,
        projectStructure: result.projectStructure,
        gitUrl: result.gitUrl,
        projectName: result.projectName,
      });
    } catch (error) {
      console.error('Git scan error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to scan git repository',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.post('/api/import/scan-local', async c => {
    try {
      const { directoryPath } = await c.req.json();

      if (!directoryPath) {
        return c.json(
          {
            success: false,
            error: 'Directory path is required',
          },
          400
        );
      }

      const result = await gitScanner.scanLocalPath(directoryPath);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400
        );
      }

      return c.json({
        success: true,
        path: result.tempPath,
        files: result.files,
        projectStructure: result.projectStructure,
      });
    } catch (error) {
      console.error('Local scan error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to scan local directory',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.delete('/api/import/cleanup/:tempId', async c => {
    try {
      const tempId = c.req.param('tempId');

      // Extract temp path from tempId (base64 encoded path)
      const tempPath = Buffer.from(tempId, 'base64').toString();

      await gitScanner.cleanup(tempPath);

      return c.json({
        success: true,
        message: 'Temporary directory cleaned up',
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to cleanup temporary directory',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  // GitHub API endpoints
  app.get('/api/github/user/repos', async c => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          response.status
        );
      }

      const repositories = await response.json();

      return c.json({
        success: true,
        repositories: repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          owner: {
            login: repo.owner.login,
            type: repo.owner.type,
            avatar_url: repo.owner.avatar_url,
          },
        })),
      });
    } catch (error) {
      console.error('Failed to fetch GitHub user repos:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch repositories',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.get('/api/github/user/orgs', async c => {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch('https://api.github.com/user/orgs', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          response.status
        );
      }

      const organizations = await response.json();

      return c.json({
        success: true,
        organizations: organizations.map((org: any) => ({
          login: org.login,
          id: org.id,
          description: org.description,
          avatar_url: org.avatar_url,
          public_repos: org.public_repos,
        })),
      });
    } catch (error) {
      console.error('Failed to fetch GitHub user orgs:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch organizations',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.get('/api/github/orgs/:org/repos', async c => {
    const org = c.req.param('org');
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return c.json(
        {
          success: false,
          error: 'GITHUB_TOKEN environment variable not set',
        },
        400
      );
    }

    try {
      const response = await fetch(
        `https://api.github.com/orgs/${org}/repos?per_page=100&sort=updated`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return c.json(
          {
            success: false,
            error: `GitHub API error: ${errorData.message}`,
          },
          response.status
        );
      }

      const repositories = await response.json();

      return c.json({
        success: true,
        repositories: repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          clone_url: repo.clone_url,
          ssh_url: repo.ssh_url,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          updated_at: repo.updated_at,
          owner: {
            login: repo.owner.login,
            type: repo.owner.type,
            avatar_url: repo.owner.avatar_url,
          },
        })),
      });
    } catch (error) {
      console.error('Failed to fetch GitHub org repos:', error);
      return c.json(
        {
          success: false,
          error: 'Failed to fetch organization repositories',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  return app;
}
