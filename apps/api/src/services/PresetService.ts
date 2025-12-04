const DEFAULT_STRUCTURE = {
  servicesDirectory: "services",
  clientsDirectory: "clients",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
};

interface PresetArtifactInput {
  name: string;
  type: string;
  description?: string | null;
  language?: string | null;
  framework?: string | null;
  metadata?: Record<string, unknown>;
  filePath?: string | null;
}

export interface PresetProjectData {
  resolvedSpec: Record<string, unknown>;
  artifacts: PresetArtifactInput[];
  structure?: Record<string, unknown>;
}

const PRESET_BUILDERS: Record<
  string,
  (projectId: string, projectName: string) => PresetProjectData
> = {
  "web-app": (_projectId, projectName) => {
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
        description:
          "Docker Compose definition for the frontend, REST API, and PostgreSQL database.",
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
  },
  "mobile-app": (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const frontendPackage = {
      packageName: "mobile-app",
      packageRoot: "clients/mobile",
      frameworks: ["react-native"],
      components: [
        {
          name: "HomeScreen",
          filePath: "clients/mobile/src/screens/Home.tsx",
          framework: "React Native",
          description: "Landing experience with personalized content.",
        },
        {
          name: "ProfileScreen",
          filePath: "clients/mobile/src/screens/Profile.tsx",
          framework: "React Native",
          description: "Profile management and account preferences.",
        },
      ],
      routes: [
        {
          path: "/home",
          filePath: "clients/mobile/src/screens/Home.tsx",
          displayLabel: "/home",
          routerType: "react-native-stack",
        },
        {
          path: "/profile",
          filePath: "clients/mobile/src/screens/Profile.tsx",
          displayLabel: "/profile",
          routerType: "react-native-stack",
        },
        {
          path: "/settings",
          filePath: "clients/mobile/src/screens/Settings.tsx",
          displayLabel: "/settings",
          routerType: "react-native-stack",
        },
      ],
    };

    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            "Cross-platform mobile application preset with React Native UI and supporting API.",
          goals: [
            "Provide native-feeling mobile experience",
            "Sync data when online and offline",
            "Deliver push notification capabilities",
          ],
        },
        ui: {
          routes:
            frontendPackage.routes?.map((route) => ({
              id: route.path.replace("/", "") || "home",
              path: route.path,
              name: `${route.displayLabel} Screen`.trim(),
            })) ?? [],
          views:
            frontendPackage.components?.map((component) => ({
              id: component.name.toLowerCase(),
              name: component.name,
              filePath: component.filePath,
              description: component.description,
            })) ?? [],
        },
        services: {
          api: {
            name: "mobile-api",
            description: "Node.js API optimized for mobile use-cases.",
            technology: "Node.js 20 + Fastify",
            language: "TypeScript",
            endpoints: [
              { method: "GET", path: "/api/feed", description: "Fetch personalized feed." },
              { method: "POST", path: "/api/profile", description: "Update profile information." },
            ],
            metadata: {
              presetId: "mobile-app",
              type: "service",
            },
          },
          notifications: {
            name: "notifications-worker",
            description: "Background worker dispatching push notifications.",
            technology: "Node.js 20 + BullMQ",
            language: "TypeScript",
            metadata: {
              presetId: "mobile-app",
              type: "job",
            },
          },
        },
        frontend: {
          packages: [frontendPackage],
        },
        databases: {
          cache: {
            name: "mobile-cache",
            engine: "redis",
            description: "Caching layer for offline synchronization.",
          },
        },
        tools: {
          pipeline: {
            name: "mobile-pipeline",
            description: "CI pipeline for building and distributing mobile binaries.",
            commands: ["build:ios", "build:android", "publish"],
          },
        },
        infrastructure: {
          containers: [
            {
              name: "mobile-api",
              image: "node:20-alpine",
              scope: "service",
              ports: [{ containerPort: 3001 }],
            },
            { name: "notifications-worker", image: "node:20-alpine", scope: "job", ports: [] },
            {
              name: "redis",
              image: "redis:7-alpine",
              scope: "cache",
              ports: [{ containerPort: 6379 }],
            },
          ],
        },
      },
      meta: {
        presetId: "mobile-app",
        generatedAt: timestamp,
      },
    } as Record<string, unknown>;

    const artifacts: PresetArtifactInput[] = [
      {
        name: "mobile-app",
        type: "frontend",
        description: "React Native application delivered through Expo.",
        language: "typescript",
        framework: "react-native",
        filePath: frontendPackage.packageRoot,
        metadata: {
          presetId: "mobile-app",
          detectedType: "frontend",
          packageRoot: frontendPackage.packageRoot,
          frameworks: frontendPackage.frameworks,
        },
      },
      {
        name: "mobile-api",
        type: "service",
        description: "API optimized for mobile workloads.",
        language: "typescript",
        framework: "fastify",
        filePath: "services/mobile-api",
        metadata: {
          presetId: "mobile-app",
          endpoints: ["/api/feed", "/api/profile"],
        },
      },
      {
        name: "notifications-worker",
        type: "service",
        description: "Background worker delivering push notifications.",
        language: "typescript",
        framework: "bullmq",
        filePath: "services/notifications-worker",
        metadata: {
          presetId: "mobile-app",
          type: "job",
        },
      },
      {
        name: "mobile-cache",
        type: "database",
        description: "Redis cache supporting offline sync.",
        language: null,
        framework: null,
        filePath: "infra/cache",
        metadata: {
          presetId: "mobile-app",
          engine: "redis",
        },
      },
    ];

    return {
      resolvedSpec,
      artifacts,
      structure: { ...DEFAULT_STRUCTURE },
    };
  },
  "api-service": (_projectId, projectName) => {
    const timestamp = new Date().toISOString();
    const resolvedSpec = {
      spec: {
        product: {
          name: projectName,
          description:
            "Preset for a production-ready REST API with documentation and observability.",
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
  },
  microservice: (_projectId, projectName) => {
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
  },
};

export class PresetService {
  listPresetIds(): string[] {
    return Object.keys(PRESET_BUILDERS);
  }

  getPreset(id: string, projectId: string, projectName: string): PresetProjectData {
    const builder = PRESET_BUILDERS[id];
    if (!builder) {
      throw new Error(`Unknown preset: ${id}`);
    }
    return builder(projectId, projectName);
  }
}

export const presetService = new PresetService();
export { DEFAULT_STRUCTURE };
