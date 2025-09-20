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

export function createApiRouter(_: Dependencies) {
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

  return app;
}
