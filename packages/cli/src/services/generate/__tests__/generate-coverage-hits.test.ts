import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import type { AppSpec } from "@arbiter/shared";
import fs from "fs-extra";
import { __generateTesting, collectClientTargets, normalizeCapabilities } from "../index.js";

describe("generate coverage spot checks", () => {
  it("covers capability normalization loop and multiple clients", () => {
    const caps = normalizeCapabilities(["search", { name: "Billing", id: "billing-id" }]);
    expect(caps).toBeDefined();
    expect(Object.keys(caps ?? {}).sort()).toEqual(["billing-id", "search"]);

    const appSpec = {
      product: { name: "MegaApp" },
      clients: {
        web: { sourceDirectory: "custom/web" },
        admin: {},
      },
    } as unknown as AppSpec;

    const targets = collectClientTargets(appSpec, { clientsDirectory: "clients" } as any, "/tmp");
    expect(targets.map((t) => t.slug)).toEqual(["web", "admin"]);
  });

  it("discovers specs and selects via resolveAssemblyPath", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-specs-"));
    const one = path.join(tmp, ".arbiter", "one");
    const two = path.join(tmp, ".arbiter", "two");
    await fs.ensureDir(one);
    await fs.ensureDir(two);
    await fs.writeFile(path.join(one, "assembly.cue"), "// spec one");
    await fs.writeFile(path.join(two, "assembly.cue"), "// spec two");

    const prev = process.cwd();
    process.chdir(tmp);

    const specs = __generateTesting.discoverSpecs();
    expect(specs.map((s) => s.name).sort()).toEqual(["one", "two"]);
    expect(__generateTesting.resolveAssemblyPath("one", { spec: undefined } as any)).toContain(
      "one",
    );
    expect(__generateTesting.resolveAssemblyPath(undefined, { spec: undefined } as any)).toBeNull();

    process.chdir(prev);
    await fs.remove(tmp);
  });

  it("builds rich route component content with actions and success state", () => {
    const content = __generateTesting.buildRouteComponentContent(
      { id: "checkout", path: "/checkout" },
      "Checkout",
      "CheckoutDef",
      "/checkout",
      "Checkout",
      "desc",
      "",
      { "page:checkout": 'data-testid="checkout-root"' },
      {
        rootTestId: "checkout-root",
        actionTestIds: ["submit-btn", "apply-coupon"],
        successTestId: "checkout-success",
        apiInteractions: [],
      },
    );

    expect(content).toContain("submit-btn");
    expect(content).toContain("checkout-success");
    expect(content).toContain("Checkout");
  });

  it("derives service endpoints from paths and flows", () => {
    const appSpec = {
      services: {
        Orders: {
          language: "typescript",
          domains: ["orders"],
        },
      },
      flows: [
        {
          id: "place-order",
          steps: [
            {
              expect_api: {
                path: "/orders/create",
                method: "post",
                status: 201,
              },
            },
          ],
        },
      ],
    } as unknown as AppSpec;

    const endpoints = __generateTesting.deriveServiceEndpointsFromPaths(
      {
        paths: {
          Orders: {
            "/orders/create": {
              post: { summary: "Create order", responses: { "201": { description: "ok" } } },
            },
          },
        },
      } as any,
      "Orders",
      "orders",
      { language: "typescript", domains: ["orders"] },
    );
    expect(endpoints[0]?.url).toBe("/orders/create");

    const flowEndpoints = __generateTesting.deriveServiceEndpointsFromFlows(
      appSpec,
      "Orders",
      "orders",
      { language: "typescript" },
    );
    expect(flowEndpoints[0]?.summary).toContain("place-order");
  });
});
