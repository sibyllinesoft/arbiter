import { describe, expect, it } from "bun:test";
import { __generateTesting } from "@/services/generate/io/index.js";

const structure = {
  clientsDirectory: "clients",
  servicesDirectory: "services",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  packageRelative: { testsDirectory: false, docsDirectory: false, infraDirectory: false },
};

describe("create targets and paths", () => {
  it("collects fallback client when none specified", () => {
    const appSpec: any = { product: { name: "Solo" }, ui: { routes: [] }, flows: [], locators: {} };
    const targets = __generateTesting.collectClientTargets(appSpec, structure as any, "/tmp/out");
    expect(targets[0].slug).toBe("solo");
  });

  it("creates client and service targets with expected relative roots", () => {
    const client = __generateTesting.createClientTarget(
      "Web",
      { sourceDirectory: "apps/web" } as any,
      structure as any,
      "/tmp/root",
    );
    expect(client.relativeRoot).toBe("apps/web");
    expect(client.context.testsDir).toContain("/tmp/root/tests/web");

    const svc = __generateTesting.createServiceTarget(
      "Billing",
      { language: "Go" },
      structure as any,
      "/tmp/root",
    );
    expect(svc.relativeRoot).toBe("services/billing");
    expect(svc.language).toBe("go");
  });

  it("computes relative paths with toRelativePath", () => {
    expect(__generateTesting.toRelativePath("/a/b", "/a/b/c")).toBe("c");
    expect(__generateTesting.toRelativePath("/a/b", "/a/b")).toBeNull();
  });
});
