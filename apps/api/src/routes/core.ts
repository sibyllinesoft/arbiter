import path from 'path';
import fs from 'fs-extra';
import { glob } from 'glob';
import { Hono } from 'hono';

type Dependencies = Record<string, unknown>;

interface SearchResult {
  title: string;
  type: string;
  path: string;
  content: string;
  relevance: number;
}

export function createCoreRouter(deps: Dependencies) {
  const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

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
          cwd: PROJECT_ROOT,
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
              const relativePath = path.relative(PROJECT_ROOT, filePath);
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

  const router = new Hono();

  router.post('/validate', async c => {
    return c.json({ success: true, spec_hash: 'stubbed', resolved: {} });
  });

  // Search endpoint for MCP
  router.post('/search', async c => {
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
  router.post('/fetch', async c => {
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
      const fullPath = path.resolve(PROJECT_ROOT, normalizedPath);

      // Security check - ensure the path is within the project directory
      if (!fullPath.startsWith(`${PROJECT_ROOT}/`)) {
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

  return router;
}
