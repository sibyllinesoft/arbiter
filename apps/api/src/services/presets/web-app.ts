/**
 * @module services/presets/web-app
 * Web application preset builder.
 */
import { DEFAULT_STRUCTURE, type PresetArtifactInput, type PresetProjectData } from "./types";

export function buildWebAppPreset(_projectId: string, projectName: string): PresetProjectData {
  const timestamp = new Date().toISOString();
  const composeYaml = `version: '3.9'
services:
  frontend:
    build: ./clients/web
    environment:
      NODE_ENV: development
      API_HTTP_URL: http://rest:3000
    ports:
      - '5173:5173'
    depends_on:
      - rest
  rest:
    build: ./services/rest
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/app
    ports:
      - '3000:3000'
    depends_on:
      - postgres
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data: {}
`;
  const resolvedSpec = {
    spec: {
      product: {
        name: projectName,
        description:
          "Full-stack web application preset with a React frontend, Node.js API tier, and PostgreSQL database.",
        goals: [
          "Deliver a responsive user experience",
          "Expose a well-documented REST API",
          "Support secure authentication and account management",
        ],
      },
      ui: {
        routes: [{ id: "root", path: "/" }],
        views: [
          {
            id: "root-view",
            name: "RootView",
            filePath: "clients/web/src/routes/root.tsx",
            description: "Entry view rendered at the application root.",
          },
        ],
      },
      services: {
        rest: {
          name: "rest-service",
          description: "Fastify REST API providing backend capabilities for the web application.",
          technology: "Node.js 20 + Fastify",
          language: "TypeScript",
          depends_on: ["app-db"],
          endpoints: [
            { method: "GET", path: "/api/rest", description: "List resources." },
            { method: "POST", path: "/api/rest", description: "Create a resource." },
          ],
          metadata: {
            presetId: "web-app",
            type: "service",
            packagePath: "services/rest",
            depends_on: ["app-db"],
          },
        },
      },
      databases: {
        primary: {
          name: "app-db",
          engine: "postgresql",
          description: "Primary relational database storing transactional data.",
          schemas: ["public", "audit"],
        },
      },
      modules: {
        frontend: {
          name: "frontend-app",
          description: "React frontend package served via Vite.",
          language: "TypeScript",
          metadata: {
            presetId: "web-app",
            type: "frontend",
            packagePath: "clients/web",
          },
        },
        shared: {
          name: "shared-library",
          description: "Reusable TypeScript utilities shared across services.",
          language: "TypeScript",
        },
      },
      frontend: {
        packages: [
          {
            packageName: "frontend-app",
            packageRoot: "clients/web",
            frameworks: ["react"],
            depends_on: ["rest-service"],
            components: [
              {
                name: "RootView",
                filePath: "clients/web/src/routes/root.tsx",
                framework: "React",
                description: "Entry view rendered at the application root.",
              },
            ],
            routes: [
              {
                path: "/",
                filePath: "clients/web/src/routes/root.tsx",
                displayLabel: "/",
                routerType: "react-router",
                isBaseRoute: true,
              },
            ],
          },
        ],
      },
      tools: {
        cli: {
          name: "project-cli",
          description: "Developer experience CLI with build and test helpers.",
          commands: ["dev", "lint", "test"],
        },
      },
      infrastructure: {
        containers: [
          {
            name: "frontend",
            image: "node:20-alpine",
            scope: "frontend",
            ports: [{ containerPort: 5173 }],
          },
          {
            name: "rest",
            image: "node:20-alpine",
            scope: "service",
            ports: [{ containerPort: 3000 }],
          },
          {
            name: "postgres",
            image: "postgres:15",
            scope: "database",
            ports: [{ containerPort: 5432 }],
          },
        ],
        compose: {
          file: "docker-compose.yml",
          services: ["frontend", "rest", "postgres"],
        },
      },
    },
    meta: {
      presetId: "web-app",
      generatedAt: timestamp,
    },
  } as Record<string, unknown>;

  const artifacts: PresetArtifactInput[] = [
    {
      name: "frontend-app",
      type: "frontend",
      description: "React SPA delivered with Vite dev server.",
      language: "typescript",
      framework: "react",
      filePath: "clients/web",
      metadata: {
        presetId: "web-app",
        detectedType: "frontend",
        technology: "React 18 + Vite",
        role: "frontend",
        depends_on: ["rest-service"],
      },
    },
    {
      name: "rest-service",
      type: "service",
      description: "Fastify REST API serving the web application.",
      language: "typescript",
      framework: "fastify",
      filePath: "services/rest",
      metadata: {
        presetId: "web-app",
        depends_on: ["app-db"],
        endpoints: ["/api/rest"],
      },
    },
    {
      name: "app-db",
      type: "database",
      description: "PostgreSQL database for transactional data.",
      language: null,
      framework: null,
      filePath: "infra/database",
      metadata: {
        presetId: "web-app",
        engine: "postgresql",
        version: "15",
      },
    },
    {
      name: "project-cli",
      type: "tool",
      description: "Developer productivity CLI.",
      language: "typescript",
      framework: null,
      filePath: "tools/cli",
      metadata: {
        presetId: "web-app",
        commands: ["dev", "lint", "test"],
      },
    },
    {
      name: "docker-compose",
      type: "infrastructure",
      description: "Docker Compose definition for the frontend, REST API, and PostgreSQL database.",
      language: null,
      framework: null,
      filePath: "infra/docker-compose.yml",
      metadata: {
        presetId: "web-app",
        compose: true,
        composeYaml,
      },
    },
  ];

  return {
    resolvedSpec,
    artifacts,
    structure: { ...DEFAULT_STRUCTURE },
  };
}
