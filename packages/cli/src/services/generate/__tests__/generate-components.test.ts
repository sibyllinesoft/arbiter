import { describe, expect, it } from "bun:test";
import { __generateTesting } from "@/services/generate/io/index.js";

describe("build route components and docker artifacts", () => {
  it("renders non-interactive route with sanitized test id", () => {
    const content = __generateTesting.buildRouteComponentContent(
      { id: "Home", path: "/" },
      "HomeComponent",
      "HomeDef",
      "/",
      "Home",
      "Welcome",
      "",
      {},
      undefined,
    );

    expect(content).toContain('data-testid="home"');
    expect(content).toContain("HomeComponent");
  });

  it("renders interactive route with actions and api interactions", () => {
    const flowMeta = {
      rootTestId: "root",
      actionTestIds: ["do-thing"],
      successTestId: "done",
      apiInteractions: [{ method: "POST", path: "/api/do" }],
    };

    const content = __generateTesting.buildRouteComponentContent(
      { id: "Action", path: "/action" },
      "ActionComponent",
      "ActionDef",
      "/action",
      "Action",
      "Do stuff",
      "",
      {},
      flowMeta as any,
    );

    expect(content).toContain("handleAction('do-thing')");
    expect(content).toContain("/api/do");
    expect(content).toContain("success");
  });

  it("builds default service docker artifacts for supported languages and returns null for unsupported", () => {
    expect(
      __generateTesting.buildDefaultServiceDockerArtifacts({
        language: "typescript",
        ports: [3000],
        packageManager: "bun",
      }),
    ).not.toBeNull();
    expect(
      __generateTesting.buildDefaultServiceDockerArtifacts({
        language: "python",
        ports: [8000],
        packageManager: "pip",
      }),
    ).not.toBeNull();
    expect(
      __generateTesting.buildDefaultServiceDockerArtifacts({
        language: "unknown",
        ports: [],
      }),
    ).toBeNull();
  });

  it("builds default client docker artifacts when language supported", () => {
    expect(
      __generateTesting.buildDefaultClientDockerArtifacts({
        language: "typescript",
        ports: [5173],
        packageManager: "npm",
      }),
    ).not.toBeNull();
    expect(
      __generateTesting.buildDefaultClientDockerArtifacts({
        language: "go",
        ports: [],
      }),
    ).toBeNull();
  });
});
