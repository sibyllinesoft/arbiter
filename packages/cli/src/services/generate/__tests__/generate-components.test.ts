import { describe, expect, it } from "vitest";
import { __generateTesting } from "../index.js";

const pkgManagerBun = { name: "bun", run: (cmd: string) => `bun ${cmd}` } as any;
const pkgManagerNpm = { name: "npm", run: (cmd: string) => `npm run ${cmd}` } as any;

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
      __generateTesting.buildDefaultServiceDockerArtifacts(
        "typescript",
        { slug: "svc" } as any,
        {},
        pkgManagerBun,
      ),
    ).not.toBeNull();
    expect(
      __generateTesting.buildDefaultServiceDockerArtifacts(
        "python",
        { slug: "svc" } as any,
        {},
        pkgManagerNpm,
      ),
    ).not.toBeNull();
    expect(
      __generateTesting.buildDefaultServiceDockerArtifacts(
        "unknown",
        { slug: "svc" } as any,
        {},
        pkgManagerNpm,
      ),
    ).toBeNull();
  });

  it("builds default client docker artifacts when language supported", () => {
    expect(
      __generateTesting.buildDefaultClientDockerArtifacts(
        "typescript",
        { slug: "web" } as any,
        {} as any,
        pkgManagerNpm,
      ),
    ).not.toBeNull();
    expect(
      __generateTesting.buildDefaultClientDockerArtifacts(
        "go",
        { slug: "web" } as any,
        {} as any,
        pkgManagerNpm,
      ),
    ).toBeNull();
  });
});
