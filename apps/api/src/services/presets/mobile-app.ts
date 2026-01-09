/**
 * @module services/presets/mobile-app
 * Mobile application preset builder.
 */
import { DEFAULT_STRUCTURE, type PresetArtifactInput, type PresetProjectData } from "./types";

export function buildMobileAppPreset(_projectId: string, projectName: string): PresetProjectData {
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
}
