import { describe, expect, it } from "bun:test";
import { __listTesting } from "@/services/list/index.js";

const spec = {
  services: {
    api: { language: "typescript", endpoints: { get: {}, post: {} } },
  },
  modules: {
    web: { metadata: { type: "frontend", framework: "react" }, language: "ts" },
    cap: { type: "capability", description: "cap" },
  },
  paths: {
    api: {
      "/users": { get: {}, post: {} },
    },
  },
  ui: {
    routes: [{ id: "home", path: "/" }],
    views: [{ id: "main", filePath: "views/main.tsx" }],
  },
  schemas: {
    user: { references: { address: {} } },
  },
  databases: {
    db: { engine: "postgres" },
  },
  tools: {
    cli: { commands: ["build"] },
  },
  infrastructure: {
    containers: [{ name: "api", scope: "service", image: "api:latest" }],
  },
  contracts: {
    workflows: {
      billing: { operations: { charge: {} } },
    },
  },
  domain: {
    processes: {
      checkout: { states: { start: {}, done: {} } },
    },
  },
};

describe("buildComponentsFromSpec coverage", () => {
  it("builds endpoints and routes and views", () => {
    const endpoints = __listTesting.buildComponentsFromSpec(spec, "endpoint");
    expect(endpoints[0].service).toBe("api");

    const routes = __listTesting.buildComponentsFromSpec(spec, "route");
    expect(routes[0].name).toBe("home");

    const views = __listTesting.buildComponentsFromSpec(spec, "view");
    expect(views[0].path).toBe("views/main.tsx");
  });

  it("builds schemas, databases, modules, tools, infra, contracts, flows, capabilities", () => {
    expect(__listTesting.buildComponentsFromSpec(spec, "schema")[0].name).toBe("user");
    expect(__listTesting.buildComponentsFromSpec(spec, "database")[0].engine).toBe("postgres");
    expect(__listTesting.buildComponentsFromSpec(spec, "package")[0].language).toBe("ts");
    expect(__listTesting.buildComponentsFromSpec(spec, "tool")[0].commands).toContain("build");
    expect(__listTesting.buildComponentsFromSpec(spec, "infrastructure")[0].image).toBe(
      "api:latest",
    );
    expect(__listTesting.buildComponentsFromSpec(spec, "contract")[0].operations).toContain(
      "charge",
    );
    expect(__listTesting.buildComponentsFromSpec(spec, "flow")[0].states).toContain("start");
    expect(__listTesting.buildComponentsFromSpec(spec, "capability")[0].description).toBe("cap");
  });
});
