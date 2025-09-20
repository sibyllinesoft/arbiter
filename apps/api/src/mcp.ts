import { StreamableHTTPTransport } from '@hono/mcp';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';
import { z } from 'zod';

function createMcpServer() {
  const server = new McpServer({
    name: 'arbiter-api',
    version: '1.0.0',
  });

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
              mcp_tools: ['check_health', 'validate_spec', 'get_server_info'],
              include_metrics,
            },
            null,
            2
          ),
        },
      ],
    })
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

      return transport.handleRequest(c);
    } catch (error) {
      console.error('MCP Server Error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  return app;
}
