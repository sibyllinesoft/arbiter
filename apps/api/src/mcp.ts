import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5050";

function createMcpServer() {
  const server = new McpServer(
    {
      name: "arbiter-api",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register health check tool
  server.registerTool(
    "check_health",
    {
      title: "Health Check",
      description: "Check the health status of the Arbiter API server",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "healthy",
              timestamp: new Date().toISOString(),
              server: "Arbiter API",
              version: "1.0.0",
              public_url: "https://arbiter-dev.sibylline.dev",
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  // Register server info tool
  server.registerTool(
    "get_server_info",
    {
      title: "Server Information",
      description: "Get comprehensive server information and capabilities",
      inputSchema: {
        include_metrics: z.boolean().optional().describe("Whether to include performance metrics"),
      },
    },
    async ({ include_metrics = false }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              server: "Arbiter API",
              version: "1.0.0",
              capabilities: ["webhook_handling", "mcp_integration"],
              endpoints: ["/health", "/mcp", "/webhooks/*", "/api/*"],
              public_url: "https://arbiter-dev.sibylline.dev",
              timestamp: new Date().toISOString(),
              mcp_tools: [
                "check_health",
                "get_server_info",
                "search",
                "fetch",
                "add_service",
                "add_endpoint",
                "add_route",
                "add_flow",
                "add_load-balancer",
                "add_database",
                "add_cache",
                "add_locator",
                "add_schema",
                "add_package",
                "add_component",
                "add_module",
                "add_epic",
                "add_task",
              ],
              include_metrics,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  // Register search action (required by ChatGPT)
  server.registerTool(
    "search",
    {
      title: "Search Arbiter Resources",
      description:
        "Search through Arbiter specifications, documentation, handlers, and project resources",
      inputSchema: {
        query: z.string().describe("The search query to find relevant information"),
      },
    },
    async ({ query }) => {
      try {
        const searchResult = await fetch(`${API_BASE_URL}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            type: "all",
            limit: 10,
          }),
        }).then((r) => r.json());

        // Transform results to match ChatGPT's expected format
        const results = (searchResult.results || []).map((result: any, index: number) => ({
          id: `${result.path}-${index}`,
          title: result.title,
          url: `file://${result.path}`,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ results }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Register fetch action (required by ChatGPT)
  server.registerTool(
    "fetch",
    {
      title: "Fetch File Content",
      description: "Fetch the complete content of a specific file from the Arbiter project",
      inputSchema: {
        id: z.string().describe("The unique identifier for the document to fetch"),
      },
    },
    async ({ id }) => {
      try {
        // Extract path from the id (format: "path-index")
        const path = id.split("-").slice(0, -1).join("-");

        const fetchResult = await fetch(`${API_BASE_URL}/api/fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            encoding: "utf-8",
          }),
        }).then((r) => r.json());

        if (!fetchResult.success) {
          return {
            content: [
              {
                type: "text",
                text: `Fetch failed: ${fetchResult.error || "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }

        // Transform result to match ChatGPT's expected format
        const result = {
          id,
          title: fetchResult.path.split("/").pop() || "Unknown",
          text: fetchResult.content,
          url: `file://${fetchResult.path}`,
          metadata: {
            size: fetchResult.size,
            type: fetchResult.type,
            lastModified: fetchResult.lastModified,
            source: "arbiter_project",
          },
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Register add commands for building specifications
  const addCommands = [
    { name: "service", description: "Add a service to the specification" },
    { name: "endpoint", description: "Add an API endpoint to a service" },
    { name: "route", description: "Add a UI route for frontend applications" },
    { name: "flow", description: "Add a user flow for testing and validation" },
    { name: "load-balancer", description: "Add a load balancer with health check invariants" },
    { name: "database", description: "Add a database with automatic service attachment" },
    { name: "cache", description: "Add a cache service with automatic attachment" },
    { name: "locator", description: "Add a UI locator for testing" },
    { name: "schema", description: "Add a schema for API documentation" },
    { name: "package", description: "Add a reusable package/library" },
    { name: "component", description: "Add a UI component" },
    { name: "module", description: "Add a standalone module" },
    {
      name: "epic",
      description: "Add an epic for managing dependency-driven tasks using sharded CUE storage",
    },
    { name: "task", description: "Add a task within an epic for organized development workflow" },
  ];

  for (const cmd of addCommands) {
    server.registerTool(
      `add_${cmd.name}`,
      {
        title: `Add ${cmd.name.charAt(0).toUpperCase() + cmd.name.slice(1)}`,
        description: cmd.description,
        inputSchema: {
          name: z.string().describe("Name of the component to add"),
          options: z.record(z.any()).optional().describe("Additional options for the component"),
        },
      },
      async ({ name, options = {} }) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subcommand: cmd.name,
              name,
              options: {
                ...options,
                dryRun: false,
                verbose: true,
              },
            }),
          }).then((r) => r.json());

          if (!response.success) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to add ${cmd.name}: ${response.error || "Unknown error"}`,
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  action: `add_${cmd.name}`,
                  name,
                  message: response.message || `Successfully added ${cmd.name}: ${name}`,
                  details: response.details,
                }),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to add ${cmd.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}

export function createMcpApp() {
  const app = new Hono();

  app.all("/mcp", async (c) => {
    try {
      const server = createMcpServer();
      const transport = new StreamableHTTPTransport();

      await server.connect(transport);

      return await transport.handleRequest(c);
    } catch (error) {
      console.error("MCP Server Error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  return app;
}
