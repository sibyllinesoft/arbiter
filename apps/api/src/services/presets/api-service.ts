/**
 * @module services/presets/api-service
 * API service preset builder.
 */
import { DEFAULT_STRUCTURE, type PresetArtifactInput, type PresetProjectData } from "./types";

export function buildApiServicePreset(_projectId: string, projectName: string): PresetProjectData {
  const timestamp = new Date().toISOString();
  const resolvedSpec = {
    spec: {
      product: {
        name: projectName,
        description: "Preset for a production-ready REST API with documentation and observability.",
        goals: [
          "Expose versioned REST endpoints",
          "Provide comprehensive API documentation",
          "Instrument metrics for monitoring",
        ],
      },
      services: {
        api: {
          name: "core-api",
          description: "REST API built with Fastify.",
          technology: "Node.js 20 + Fastify",
          language: "TypeScript",
          endpoints: [
            { method: "GET", path: "/v1/resources", description: "List resources." },
            { method: "POST", path: "/v1/resources", description: "Create a resource." },
          ],
          metadata: {
            presetId: "api-service",
            type: "service",
          },
        },
        worker: {
          name: "background-worker",
          description: "Queue processing worker for async jobs.",
          technology: "Node.js 20 + BullMQ",
          language: "TypeScript",
          metadata: {
            presetId: "api-service",
            type: "job",
          },
        },
      },
      databases: {
        primary: {
          name: "api-db",
          engine: "postgresql",
          description: "Transactional database backing the API.",
        },
      },
      tools: {
        docs: {
          name: "api-docs",
          description: "OpenAPI documentation bundle.",
          commands: ["docs:generate"],
        },
        tests: {
          name: "contract-tests",
          description: "Postman collection runner for contract testing.",
        },
      },
      infrastructure: {
        containers: [
          {
            name: "core-api",
            image: "node:20-alpine",
            scope: "service",
            ports: [{ containerPort: 3000 }],
          },
          { name: "worker", image: "node:20-alpine", scope: "job", ports: [] },
          {
            name: "postgres",
            image: "postgres:15",
            scope: "database",
            ports: [{ containerPort: 5432 }],
          },
        ],
      },
    },
    meta: {
      presetId: "api-service",
      generatedAt: timestamp,
    },
  } as Record<string, unknown>;

  const artifacts: PresetArtifactInput[] = [
    {
      name: "core-api",
      type: "service",
      description: "Fastify REST API exposing versioned endpoints.",
      language: "typescript",
      framework: "fastify",
      filePath: "services/core-api",
      metadata: {
        presetId: "api-service",
        endpoints: ["/v1/resources"],
      },
    },
    {
      name: "background-worker",
      type: "service",
      description: "Queue processing worker handling asynchronous tasks.",
      language: "typescript",
      framework: "bullmq",
      filePath: "services/background-worker",
      metadata: {
        presetId: "api-service",
        type: "job",
      },
    },
    {
      name: "api-db",
      type: "database",
      description: "Primary PostgreSQL database for the API.",
      language: null,
      framework: null,
      filePath: "infra/database",
      metadata: {
        presetId: "api-service",
        engine: "postgresql",
      },
    },
    {
      name: "api-docs",
      type: "tool",
      description: "OpenAPI documentation package.",
      language: "typescript",
      framework: null,
      filePath: "tools/docs",
      metadata: {
        presetId: "api-service",
        commands: ["docs:generate"],
      },
    },
  ];

  return {
    resolvedSpec,
    artifacts,
    structure: { ...DEFAULT_STRUCTURE },
  };
}
