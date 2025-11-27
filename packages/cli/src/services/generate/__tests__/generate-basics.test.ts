import { describe, expect, it } from "vitest";
import {
  collectClientTargets,
  createClientTarget,
  createServiceTarget,
  normalizeCapabilities,
  toRelativePath,
} from "../index.js";
import { __generateTesting } from "../index.js";

const baseStructure = {
  clientsDirectory: "clients",
  servicesDirectory: "services",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  packageRelative: { testsDirectory: true, docsDirectory: false, infraDirectory: false },
};

describe("generate basic helpers", () => {
  it("normalizes capability inputs", () => {
    expect(normalizeCapabilities(undefined)).toBeNull();
    expect(normalizeCapabilities(null)).toBeNull();

    const fromArray = normalizeCapabilities(["payments", { name: "Billing", id: "billing" }]);
    expect(fromArray).toMatchObject({
      payments: { name: "payments" },
      billing: { name: "Billing" },
    });

    const fromObject = normalizeCapabilities({ shipping: { name: "shipping" } });
    expect(fromObject).toMatchObject({ shipping: { name: "shipping" } });
  });

  it("collects client targets with fallback and explicit config", () => {
    const appSpec: any = {
      product: { name: "Demo" },
      clients: { web: { sourceDirectory: "apps/web" } },
    };
    const targets = collectClientTargets(appSpec, baseStructure as any, "/tmp/out");

    expect(targets[0].slug).toBe("web");
    expect(targets[0].context.root).toContain("apps/web");

    const fallbackTargets = collectClientTargets(
      { product: { name: "Solo" } } as any,
      baseStructure as any,
      "/tmp/out",
    );
    expect(fallbackTargets[0].key).toBe("Solo");
  });

  it("computes relative paths and client test directories", () => {
    expect(toRelativePath("/tmp/root", "/tmp/root")).toBeNull();
    expect(toRelativePath("/tmp/root", "/tmp/root/child")).toBe("child");

    const target = createClientTarget(
      "Web",
      { sourceDirectory: "packages/web" } as any,
      baseStructure as any,
      "/tmp/workspace",
    );
    expect(target.relativeRoot).toBe("packages/web");
    expect(target.context.testsDir).toBe(`/tmp/workspace/packages/web/tests`);
  });

  it("creates service targets with normalized slug and language default", () => {
    const svc = createServiceTarget("Reporting-API", {}, baseStructure as any, "/tmp/root");
    expect(svc.slug).toBe("reporting-api");
    expect(svc.language).toBe("typescript");
    expect(svc.relativeRoot).toBe("services/reporting-api");
  });

  it("detects TS-like languages and primary service ports", () => {
    expect(__generateTesting.isTypeScriptServiceLanguage(undefined)).toBe(true);
    expect(__generateTesting.isTypeScriptServiceLanguage("Node")).toBe(true);
    expect(__generateTesting.isTypeScriptServiceLanguage("python")).toBe(false);

    expect(__generateTesting.getPrimaryServicePort({}, 3000)).toBe(3000);
    expect(__generateTesting.getPrimaryServicePort({ ports: [{ targetPort: 8080 }] }, 3000)).toBe(
      8080,
    );
    expect(
      __generateTesting.getPrimaryServicePort({ ports: [{ port: "not-a-number" }] }, 4000),
    ).toBe(4000);
  });
});
