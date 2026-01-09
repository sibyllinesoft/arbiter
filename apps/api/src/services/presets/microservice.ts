/**
 * @module services/presets/microservice
 * Microservice preset builder.
 */
import { DEFAULT_STRUCTURE, type PresetArtifactInput, type PresetProjectData } from "./types";

export function buildMicroservicePreset(
  _projectId: string,
  projectName: string,
): PresetProjectData {
  const timestamp = new Date().toISOString();
  const resolvedSpec = {
    spec: {
      product: {
        name: projectName,
        description:
          "Containerized microservice preset with observability and asynchronous messaging.",
        goals: [
          "Deploy as an independent container",
          "Expose health checks for orchestration",
          "Publish domain events to a message broker",
        ],
      },
      services: {
        microservice: {
          name: "inventory-service",
          description: "Go microservice managing inventory levels.",
          technology: "Go 1.22 + Echo",
          language: "Go",
          endpoints: [
            { method: "GET", path: "/inventory", description: "List inventory items." },
            { method: "POST", path: "/inventory/reserve", description: "Reserve inventory." },
          ],
          metadata: {
            presetId: "microservice",
            type: "service",
          },
        },
        metrics: {
          name: "metrics-collector",
          description: "Prometheus metrics exporter for the service.",
          technology: "Go 1.22",
          language: "Go",
          metadata: {
            presetId: "microservice",
            type: "service",
          },
        },
      },
      infrastructure: {
        containers: [
          {
            name: "inventory-service",
            image: "golang:1.22-alpine",
            scope: "service",
            ports: [{ containerPort: 8080 }],
          },
          {
            name: "metrics",
            image: "prom/prometheus",
            scope: "observability",
            ports: [{ containerPort: 9090 }],
          },
          {
            name: "nats",
            image: "nats:2-alpine",
            scope: "messaging",
            ports: [{ containerPort: 4222 }],
          },
        ],
      },
      tools: {
        ci: {
          name: "service-pipeline",
          description: "CI pipeline with build, test, and deploy stages.",
          commands: ["build", "test", "docker:publish"],
        },
      },
    },
    meta: {
      presetId: "microservice",
      generatedAt: timestamp,
    },
  } as Record<string, unknown>;

  const artifacts: PresetArtifactInput[] = [
    {
      name: "inventory-service",
      type: "service",
      description: "Go microservice exposing inventory APIs.",
      language: "go",
      framework: "echo",
      filePath: "services/inventory",
      metadata: {
        presetId: "microservice",
        technology: "Go 1.22 + Echo",
      },
    },
    {
      name: "metrics-collector",
      type: "service",
      description: "Prometheus metrics sidecar.",
      language: "go",
      framework: null,
      filePath: "services/metrics",
      metadata: {
        presetId: "microservice",
        role: "observability",
      },
    },
    {
      name: "event-bus",
      type: "infrastructure",
      description: "NATS message broker for asynchronous communication.",
      language: null,
      framework: null,
      filePath: "infra/messaging",
      metadata: {
        presetId: "microservice",
        technology: "nats",
      },
    },
  ];

  return {
    resolvedSpec,
    artifacts,
    structure: { ...DEFAULT_STRUCTURE },
  };
}
