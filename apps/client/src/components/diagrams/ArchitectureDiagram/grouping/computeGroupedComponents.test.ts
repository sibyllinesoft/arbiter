import { describe, expect, it } from "vitest";
import { computeGroupedComponents } from "./computeGroupedComponents";

describe("computeGroupedComponents", () => {
  it("returns empty groups for null project data", () => {
    const result = computeGroupedComponents(null);
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((g) => g.items.length === 0)).toBe(true);
  });

  it("returns empty groups for undefined project data", () => {
    const result = computeGroupedComponents(undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  it("processes services from spec", () => {
    const projectData = {
      spec: {
        packages: {
          "api-service": { type: "service", name: "API Service" },
        },
      },
    };
    const result = computeGroupedComponents(projectData);
    const servicesGroup = result.find((g) => g.label === "Services");
    expect(servicesGroup).toBeDefined();
    expect(servicesGroup!.items.length).toBe(1);
    expect(servicesGroup!.items[0]!.name).toBe("api-service");
  });

  it("processes databases from spec", () => {
    const projectData = {
      spec: {
        databases: {
          postgres: { type: "database", name: "PostgreSQL" },
        },
      },
    };
    const result = computeGroupedComponents(projectData);
    const databasesGroup = result.find((g) => g.label === "Databases");
    expect(databasesGroup).toBeDefined();
    expect(databasesGroup!.items.length).toBe(1);
  });

  it("processes capabilities array", () => {
    const projectData = {
      spec: {
        capabilities: [{ name: "User Authentication" }, { name: "Data Export" }],
      },
    };
    const result = computeGroupedComponents(projectData);
    const capabilitiesGroup = result.find((g) => g.label === "Capabilities");
    expect(capabilitiesGroup).toBeDefined();
    expect(capabilitiesGroup!.items.length).toBe(2);
  });

  it("processes capabilities object", () => {
    const projectData = {
      spec: {
        capabilities: {
          auth: { name: "Authentication" },
          export: { name: "Data Export" },
        },
      },
    };
    const result = computeGroupedComponents(projectData);
    const capabilitiesGroup = result.find((g) => g.label === "Capabilities");
    expect(capabilitiesGroup).toBeDefined();
    expect(capabilitiesGroup!.items.length).toBe(2);
  });

  it("processes flows", () => {
    const projectData = {
      spec: {
        flows: [{ name: "User Registration Flow" }],
      },
    };
    const result = computeGroupedComponents(projectData);
    const flowsGroup = result.find((g) => g.label === "Flows");
    expect(flowsGroup).toBeDefined();
    expect(flowsGroup!.items.length).toBe(1);
  });

  it("processes groups with tasks", () => {
    const projectData = {
      spec: {
        groups: [
          {
            id: "sprint-1",
            name: "Sprint 1",
            tasks: [{ name: "Implement login", status: "pending" }],
          },
        ],
      },
    };
    const result = computeGroupedComponents(projectData);
    const groupsGroup = result.find((g) => g.label === "Groups");
    const tasksGroup = result.find((g) => g.label === "Tasks");
    expect(groupsGroup).toBeDefined();
    expect(groupsGroup!.items.length).toBe(1);
    expect(tasksGroup).toBeDefined();
    expect(tasksGroup!.items.length).toBe(1);
  });

  it("filters out completed tasks", () => {
    const projectData = {
      spec: {
        tasks: [
          { name: "Pending task", status: "pending" },
          { name: "Completed task", completed: true },
          { name: "Done task", done: true },
        ],
      },
    };
    const result = computeGroupedComponents(projectData);
    const tasksGroup = result.find((g) => g.label === "Tasks");
    expect(tasksGroup).toBeDefined();
    expect(tasksGroup!.items.length).toBe(1);
    expect(tasksGroup!.items[0]!.name).toBe("Pending task");
  });

  it("deduplicates tasks by ID", () => {
    const projectData = {
      spec: {
        tasks: [
          { id: "task-1", name: "Task One" },
          { id: "task-1", name: "Task One Duplicate" },
        ],
      },
    };
    const result = computeGroupedComponents(projectData);
    const tasksGroup = result.find((g) => g.label === "Tasks");
    expect(tasksGroup).toBeDefined();
    expect(tasksGroup!.items.length).toBe(1);
  });

  it("filters out removed artifacts", () => {
    const projectData = {
      spec: {
        packages: {
          "service-1": { type: "service", artifactId: "art-1", name: "Service One" },
          "service-2": { type: "service", artifactId: "art-2", name: "Service Two" },
        },
      },
    };
    const removedIds = new Set(["art-1"]);
    const result = computeGroupedComponents(projectData, removedIds);
    const servicesGroup = result.find((g) => g.label === "Services");
    expect(servicesGroup).toBeDefined();
    expect(servicesGroup!.items.length).toBe(1);
    expect(servicesGroup!.items[0]!.name).toBe("service-2");
  });

  it("processes frontend packages", () => {
    const projectData = {
      spec: {
        frontend: {
          packages: [
            {
              packageName: "web-app",
              packageRoot: "apps/web",
              frameworks: ["react"],
              components: [{ name: "Header", filePath: "apps/web/src/Header.tsx" }],
            },
          ],
        },
      },
    };
    const result = computeGroupedComponents(projectData);
    const frontendsGroup = result.find((g) => g.label === "Frontends");
    expect(frontendsGroup).toBeDefined();
    expect(frontendsGroup!.items.length).toBe(1);
  });

  it("sorts groups by item count descending", () => {
    const projectData = {
      spec: {
        packages: {
          s1: { type: "service", name: "S1" },
          s2: { type: "service", name: "S2" },
          s3: { type: "service", name: "S3" },
        },
        databases: {
          db1: { type: "database", name: "DB1" },
        },
      },
    };
    const result = computeGroupedComponents(projectData);
    // Groups with items should come before groups without items
    const servicesGroup = result.find((g) => g.label === "Services");
    const databasesGroup = result.find((g) => g.label === "Databases");
    expect(servicesGroup).toBeDefined();
    expect(databasesGroup).toBeDefined();
    expect(servicesGroup!.items.length).toBe(3);
    expect(databasesGroup!.items.length).toBe(1);
    // Services (3 items) should appear before Databases (1 item)
    const servicesIdx = result.findIndex((g) => g.label === "Services");
    const databasesIdx = result.findIndex((g) => g.label === "Databases");
    expect(servicesIdx).toBeLessThan(databasesIdx);
  });
});
