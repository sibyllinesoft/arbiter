#!/usr/bin/env bun
/**
 * Arbiter MCP Server - Stdio Interface
 *
 * This script creates a stdio-based MCP server that proxies requests to the
 * Arbiter HTTP API server running on localhost:5050.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const API_BASE_URL = "http://localhost:5050";

// Create MCP server
const server = new McpServer(
  {
    name: "arbiter-stdio",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Helper function to call the HTTP API
async function callAPI(endpoint: string, method: string = "GET", body?: any) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to call API: ${error.message}`);
  }
}

// Register health check tool
server.registerTool(
  "check_health",
  {
    title: "Health Check",
    description: "Check the health status of the Arbiter API server",
    inputSchema: {},
  },
  async () => {
    const health = await callAPI("/health");
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(health, null, 2),
        },
      ],
    };
  },
);

// Register create project tool
server.registerTool(
  "create_project",
  {
    title: "Create Project",
    description: "Initialize a new Arbiter project with specified template",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the project to create",
        },
        options: {
          type: "object",
          properties: {
            template: {
              type: "string",
              enum: ["basic", "kubernetes", "api"],
              description: "Project template to use",
            },
            directory: {
              type: "string",
              description: "Directory to create the project in",
            },
            force: {
              type: "boolean",
              description: "Force overwrite existing directory",
            },
          },
        },
      },
      required: ["name"],
    },
  },
  async ({ name, options = {} }) => {
    const result = await callAPI("/api/create", "POST", { name, options });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
);

// Register all add commands
const addCommands = [
  "service",
  "database",
  "cache",
  "load-balancer",
  "endpoint",
  "route",
  "schema",
  "flow",
  "locator",
  "package",
  "component",
  "module",
];

for (const command of addCommands) {
  server.registerTool(
    `add_${command.replace("-", "_")}`,
    {
      title: `Add ${command.charAt(0).toUpperCase() + command.slice(1)}`,
      description: `Add a ${command} to the Arbiter specification`,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: `Name of the ${command} to add`,
          },
          options: {
            type: "object",
            description: `Options for the ${command}`,
          },
        },
        required: ["name"],
      },
    },
    async ({ name, options = {} }) => {
      const result = await callAPI("/api/add", "POST", {
        subcommand: command,
        name,
        options,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Arbiter MCP Server (stdio) running...");
}

main().catch(console.error);
