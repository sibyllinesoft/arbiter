import { StreamableHTTPTransport } from '@hono/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';
import { z } from 'zod';

function createMcpServer() {
  const server = new McpServer(
    {
      name: 'arbiter-api',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register health check tool
  server.registerTool(
    'check_health',
    {
      title: 'Health Check',
      description: 'Check the health status of the Arbiter API server',
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              status: 'healthy',
              timestamp: new Date().toISOString(),
              server: 'Arbiter API',
              version: '1.0.0',
              public_url: 'https://arbiter-dev.sibylline.dev',
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // Register spec validation tool
  server.registerTool(
    'validate_spec',
    {
      title: 'Validate Specification',
      description: 'Validate a CUE specification using the Arbiter API',
      inputSchema: {
        spec_content: z.string().describe('The CUE specification content to validate'),
        spec_type: z
          .enum(['v1', 'v2', 'auto'])
          .optional()
          .describe('The type of specification (optional)'),
      },
    },
    async ({ spec_content, spec_type }) => {
      try {
        const validationResult = await fetch('http://localhost:5050/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spec_content,
            spec_type: spec_type || 'auto',
          }),
        }).then(r => r.json());

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  validation_result: validationResult,
                  message: 'Validation completed successfully',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register server info tool
  server.registerTool(
    'get_server_info',
    {
      title: 'Server Information',
      description: 'Get comprehensive server information and capabilities',
      inputSchema: {
        include_metrics: z.boolean().optional().describe('Whether to include performance metrics'),
      },
    },
    async ({ include_metrics = false }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              server: 'Arbiter API',
              version: '1.0.0',
              capabilities: ['spec_validation', 'webhook_handling', 'mcp_integration'],
              endpoints: ['/health', '/api/validate', '/mcp', '/webhooks/*'],
              public_url: 'https://arbiter-dev.sibylline.dev',
              timestamp: new Date().toISOString(),
              mcp_tools: ['check_health', 'validate_spec', 'get_server_info', 'search', 'fetch'],
              include_metrics,
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // Register search action (required by ChatGPT)
  server.registerTool(
    'search',
    {
      title: 'Search Arbiter Resources',
      description:
        'Search through Arbiter specifications, documentation, handlers, and project resources',
      inputSchema: {
        query: z.string().describe('The search query to find relevant information'),
      },
    },
    async ({ query }) => {
      try {
        const searchResult = await fetch('http://localhost:5050/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            type: 'all',
            limit: 10,
          }),
        }).then(r => r.json());

        // Transform results to match ChatGPT's expected format
        const results = (searchResult.results || []).map((result: any, index: number) => ({
          id: `${result.path}-${index}`,
          title: result.title,
          url: `file://${result.path}`,
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ results }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register fetch action (required by ChatGPT)
  server.registerTool(
    'fetch',
    {
      title: 'Fetch File Content',
      description: 'Fetch the complete content of a specific file from the Arbiter project',
      inputSchema: {
        id: z.string().describe('The unique identifier for the document to fetch'),
      },
    },
    async ({ id }) => {
      try {
        // Extract path from the id (format: "path-index")
        const path = id.split('-').slice(0, -1).join('-');

        const fetchResult = await fetch('http://localhost:5050/api/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path,
            encoding: 'utf-8',
          }),
        }).then(r => r.json());

        if (!fetchResult.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Fetch failed: ${fetchResult.error || 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }

        // Transform result to match ChatGPT's expected format
        const result = {
          id,
          title: fetchResult.path.split('/').pop() || 'Unknown',
          text: fetchResult.content,
          url: `file://${fetchResult.path}`,
          metadata: {
            size: fetchResult.size,
            type: fetchResult.type,
            lastModified: fetchResult.lastModified,
            source: 'arbiter_project',
          },
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

export function createMcpApp() {
  const app = new Hono();

  app.all('/mcp', async c => {
    try {
      const server = createMcpServer();
      const transport = new StreamableHTTPTransport();

      await server.connect(transport);

      return await transport.handleRequest(c);
    } catch (error) {
      console.error('MCP Server Error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
