import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import { Hono } from 'hono';

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

  // Projects endpoint - using real database
  app.get('/api/projects', async c => {
    try {
      const db = deps.db as any;
      const projects = await db.listProjects();

      // Transform database projects to match frontend format
      const formattedProjects = projects.map((project: any) => ({
        id: project.id,
        name: project.name,
        status: 'active',
        services: 0, // TODO: calculate from fragments
        databases: 0, // TODO: calculate from fragments
        lastActivity: project.updated_at,
      }));

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
      const { name } = body;

      if (!name) {
        return c.json({ error: 'Project name is required' }, 400);
      }

      // Generate project ID
      const projectId = `smith-project-${Date.now()}`;

      const project = await db.createProject(projectId, name);

      return c.json({
        id: project.id,
        name: project.name,
        status: 'active',
        services: 0,
        databases: 0,
        lastActivity: project.created_at,
      });
    } catch (error) {
      console.error('Error creating project:', error);
      return c.json({ error: 'Failed to create project' }, 500);
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
    const response = await _.handlersApi.getExecutionHistory(request);
    return c.json(response);
  });

  app.get('/api/handlers/stats', async c => {
    const response = await _.handlersApi.getHandlerStats();
    return c.json(response);
  });

  app.post('/api/handlers/validate', async c => {
    const { filePath } = await c.req.json();
    const response = await _.handlersApi.validateHandler({ filePath });
    return c.json(response);
  });

  app.post('/api/handlers/init', async c => {
    const response = await _.handlersApi.initializeHandlerStructure();
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
    const response = await _.handlersApi.listHandlers(request);
    return c.json(response);
  });

  app.post('/api/handlers', async c => {
    const request = await c.req.json();
    const response = await _.handlersApi.createHandler(request);
    return c.json(response);
  });

  // Parameterized routes (must come after non-parameterized routes)
  app.get('/api/handlers/:id', async c => {
    const id = c.req.param('id');
    const response = await _.handlersApi.getHandler({ id });
    return c.json(response);
  });

  app.put('/api/handlers/:id', async c => {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const response = await _.handlersApi.updateHandler({ id, updates });
    return c.json(response);
  });

  app.delete('/api/handlers/:id', async c => {
    const id = c.req.param('id');
    const response = await _.handlersApi.removeHandler({ id });
    return c.json(response);
  });

  app.post('/api/handlers/:id/toggle', async c => {
    const id = c.req.param('id');
    const { enabled } = await c.req.json();
    const response = await _.handlersApi.toggleHandler({ id, enabled });
    return c.json(response);
  });

  app.post('/api/handlers/:id/reload', async c => {
    const id = c.req.param('id');
    const response = await _.handlersApi.reloadHandler({ id });
    return c.json(response);
  });

  // Missing endpoints that the frontend expects
  app.get('/api/resolved', async c => {
    const projectId = c.req.query('projectId');

    if (!projectId) {
      return c.json({ error: 'projectId parameter is required' }, 400);
    }

    // Mock resolved spec data for now
    return c.json({
      success: true,
      projectId,
      resolved: {
        apiVersion: 'v2',
        kind: 'Application',
        metadata: {
          name: `project-${projectId}`,
          version: '1.0.0',
        },
        spec: {
          services: {
            'api-service': {
              name: 'API Service',
              type: 'deployment',
              image: 'nginx:latest',
              ports: [{ port: 80, targetPort: 8080 }],
            },
          },
          ui: {
            routes: [
              {
                id: 'home',
                path: '/',
                name: 'Home',
                component: 'HomePage',
                capabilities: ['read-data'],
              },
              {
                id: 'dashboard',
                path: '/dashboard',
                name: 'Dashboard',
                component: 'DashboardPage',
                capabilities: ['analytics'],
              },
            ],
          },
          flows: [
            {
              id: 'user-login',
              name: 'User Login Flow',
              steps: [
                { visit: '/' },
                { click: { locator: 'login-button' } },
                { fill: { locator: 'email-input', value: 'user@example.com' } },
                { fill: { locator: 'password-input', value: 'password' } },
                { click: { locator: 'submit-button' } },
                { expect_api: { method: 'POST', path: '/api/auth/login' } },
              ],
            },
          ],
          capabilities: {
            'read-data': {
              name: 'Read Data',
              description: 'Capability to read application data',
            },
            analytics: {
              name: 'Analytics',
              description: 'View analytics and metrics',
            },
          },
        },
      },
    });
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

  return app;
}
