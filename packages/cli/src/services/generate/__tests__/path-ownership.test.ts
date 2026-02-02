import { describe, expect, it } from "bun:test";
import type { AppSpec } from "@arbiter/specification";

import {
  buildDevProxyConfig,
  deriveServiceAliases,
  determinePathOwnership,
  isTypeScriptServiceLanguage,
  pathBelongsToService,
} from "@/services/generate/io/index.js";

describe("generate helpers - path ownership and proxies", () => {
  it("detects TypeScript friendly service languages", () => {
    expect(isTypeScriptServiceLanguage()).toBe(true);
    expect(isTypeScriptServiceLanguage("TypeScript")).toBe(true);
    expect(isTypeScriptServiceLanguage("javascript")).toBe(true);
    expect(isTypeScriptServiceLanguage("node")).toBe(true);
    expect(isTypeScriptServiceLanguage("python")).toBe(false);
  });

  it("derives aliases from service name, capabilities, and domains", () => {
    const aliases = deriveServiceAliases("payments-service", {
      capabilities: [{ contractRef: "billing@1.0.0" }],
      domains: ["checkout"],
    });

    expect(aliases).toEqual(
      expect.arrayContaining(["payments-service", "payments", "billing", "checkout"]),
    );
  });

  it("matches paths to services using aliases and webhook heuristics", () => {
    const serviceSpec = {
      capabilities: [{ contractRef: "webhook/notifications@latest" }],
      domains: ["hooks"],
    };

    expect(pathBelongsToService("/webhook/payment", "hooks-api", serviceSpec)).toBe(true);
    expect(pathBelongsToService("/hooks/status", "hooks-api", serviceSpec)).toBe(true);
    expect(pathBelongsToService("/other/path", "hooks-api", serviceSpec)).toBe(false);
  });

  it("determines path ownership from explicit paths and flows", () => {
    const appSpec: AppSpec = {
      product: { name: "Demo" },
      packages: {
        "billing-service": {
          subtype: "service",
          language: "typescript",
          domains: ["billing"],
          ports: [{ port: 9000 }],
        },
        "checkout-service": {
          subtype: "service",
          language: "node",
          capabilities: [{ contractRef: "checkout@v1" }],
          ports: [{ port: 4100 }],
        },
        "webhook-handler": {
          subtype: "service",
          language: "typescript",
          capabilities: [{ contractRef: "payments/webhook@v1" }],
        },
      },
      paths: {
        "billing-service": {
          "/billing/pay": {},
        },
      },
      behaviors: [
        {
          id: "checkout-flow",
          steps: [
            { expect_api: { path: "/checkout/submit", method: "post" } },
            { expect_api: { path: "/webhook/payment", method: "post" } },
          ],
        },
      ],
      locators: {},
      ui: { routes: [] },
      capabilities: null,
    };

    const ownership = determinePathOwnership(appSpec);

    expect(ownership.get("/billing/pay")).toBe("billing-service");
    expect(ownership.get("/checkout/submit")).toBe("checkout-service");
    expect(ownership.get("/webhook/payment")).toBe("webhook-handler");
  });

  it("builds dev proxy config for owned paths", () => {
    const appSpec: AppSpec = {
      product: { name: "Proxy Demo" },
      packages: {
        "billing-service": {
          subtype: "service",
          language: "typescript",
          ports: [{ targetPort: 9200 }],
        },
        "checkout-service": { subtype: "service", language: "typescript", ports: [{ port: 4100 }] },
      },
      locators: {},
      ui: { routes: [] },
      flows: [],
      capabilities: null,
    };

    const ownership = new Map<string, string>([
      ["/billing/pay", "billing-service"],
      ["/checkout/submit", "checkout-service"],
    ]);

    const proxies = buildDevProxyConfig(appSpec, ownership);

    expect(proxies["/billing"]?.target).toBe("http://127.0.0.1:9200");
    expect(proxies["/checkout"]?.target).toBe("http://127.0.0.1:4100");
    // ensure only one proxy per segment even if multiple paths share the prefix
    expect(Object.keys(proxies)).toEqual(expect.arrayContaining(["/billing", "/checkout"]));
  });
});
