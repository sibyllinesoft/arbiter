import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5050";

/** MCP tool response type */
type McpToolResponse = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

/** Create a text response for MCP tools */
function createTextResponse(text: string, isError = false): McpToolResponse {
  return {
    content: [{ type: "text", text }],
    ...(isError && { isError: true }),
  };
}

/** Create an error response for MCP tools */
function createErrorResponse(operation: string, error: unknown): McpToolResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return createTextResponse(`${operation} failed: ${message}`, true);
}

/** Register health check tool */
function registerHealthCheckTool(server: McpServer): void {
  server.registerTool(
    "check_health",
    {
      title: "Health Check",
      description: "Check the health status of the Arbiter API server",
      inputSchema: {},
    },
    async () =>
      createTextResponse(
        JSON.stringify(
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
      ),
  );
}

/** List of available MCP tools */
const MCP_TOOLS = [
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
  "add_group",
  "add_task",
];

/** Register server info tool */
function registerServerInfoTool(server: McpServer): void {
  server.registerTool(
    "get_server_info",
    {
      title: "Server Information",
      description: "Get comprehensive server information and capabilities",
      inputSchema: {
        include_metrics: z.boolean().optional().describe("Whether to include performance metrics"),
      },
    },
    async ({ include_metrics = false }) =>
      createTextResponse(
        JSON.stringify(
          {
            server: "Arbiter API",
            version: "1.0.0",
            capabilities: ["mcp_integration"],
            endpoints: ["/health", "/mcp", "/api/*"],
            public_url: "https://arbiter-dev.sibylline.dev",
            timestamp: new Date().toISOString(),
            mcp_tools: MCP_TOOLS,
            include_metrics,
          },
          null,
          2,
        ),
      ),
  );
}

/** Execute search API call */
async function executeSearch(query: string): Promise<McpToolResponse> {
  const searchResult = await fetch(`${API_BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, type: "all", limit: 10 }),
  }).then((r) => r.json());

  const results = (searchResult.results || []).map((result: any, index: number) => ({
    id: `${result.path}-${index}`,
    title: result.title,
    url: `file://${result.path}`,
  }));

  return createTextResponse(JSON.stringify({ results }));
}

/** Register search tool */
function registerSearchTool(server: McpServer): void {
  server.registerTool(
    "search",
    {
      title: "Search Arbiter Resources",
      description: "Search through Arbiter specifications, documentation, and project resources",
      inputSchema: {
        query: z.string().describe("The search query to find relevant information"),
      },
    },
    async ({ query }) => {
      try {
        return await executeSearch(query);
      } catch (error) {
        return createErrorResponse("Search", error);
      }
    },
  );
}

/** Execute fetch API call */
async function executeFetch(id: string): Promise<McpToolResponse> {
  const path = id.split("-").slice(0, -1).join("-");

  const fetchResult = await fetch(`${API_BASE_URL}/api/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, encoding: "utf-8" }),
  }).then((r) => r.json());

  if (!fetchResult.success) {
    return createTextResponse(`Fetch failed: ${fetchResult.error || "Unknown error"}`, true);
  }

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

  return createTextResponse(JSON.stringify(result));
}

/** Register fetch tool */
function registerFetchTool(server: McpServer): void {
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
        return await executeFetch(id);
      } catch (error) {
        return createErrorResponse("Fetch", error);
      }
    },
  );
}

/** Add command definitions */
const ADD_COMMANDS = [
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
  {
    name: "group",
    description: "Add a group for managing dependency-driven tasks using sharded CUE storage",
  },
  { name: "task", description: "Add a task within a group for organized development workflow" },
];

/** Execute add command API call */
async function executeAddCommand(
  cmdName: string,
  name: string,
  options: Record<string, unknown>,
): Promise<McpToolResponse> {
  const response = await fetch(`${API_BASE_URL}/api/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subcommand: cmdName,
      name,
      options: { ...options, dryRun: false, verbose: true },
    }),
  }).then((r) => r.json());

  if (!response.success) {
    return createTextResponse(
      `Failed to add ${cmdName}: ${response.error || "Unknown error"}`,
      true,
    );
  }

  return createTextResponse(
    JSON.stringify({
      success: true,
      action: `add_${cmdName}`,
      name,
      message: response.message || `Successfully added ${cmdName}: ${name}`,
      details: response.details,
    }),
  );
}

/** Register add command tools */
function registerAddCommandTools(server: McpServer): void {
  for (const cmd of ADD_COMMANDS) {
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
          return await executeAddCommand(cmd.name, name, options);
        } catch (error) {
          return createErrorResponse(`add_${cmd.name}`, error);
        }
      },
    );
  }
}

/** Create and configure the MCP server with all tools */
function createMcpServer() {
  const server = new McpServer(
    { name: "arbiter-api", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  registerHealthCheckTool(server);
  registerServerInfoTool(server);
  registerSearchTool(server);
  registerFetchTool(server);
  registerAddCommandTools(server);

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
