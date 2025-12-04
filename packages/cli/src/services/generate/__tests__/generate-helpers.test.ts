import { __generateTesting } from "@/services/generate/index.js";
import type { AppSpec } from "@arbiter/shared";
import { describe, expect, it } from "vitest";

describe("generate helper utilities", () => {
  it("determines path ownership from declared paths and flows", () => {
    const appSpec: AppSpec = {
      product: { name: "Test App" },
      ui: { routes: [] },
      locators: {},
      flows: [
        {
          id: "checkout",
          steps: [
            {
              expect_api: {
                method: "post",
                path: "/orders/checkout",
                status: 201,
              },
            },
            {
              expect_api: {
                method: "get",
                path: "/payments/webhook",
              },
            },
          ],
        },
      ],
      services: {
        Orders: { language: "typescript" },
        Payments: { language: "python" },
      },
      paths: {
        Orders: {
          "/orders/cart": {},
        },
      },
    } as unknown as AppSpec;

    const ownership = __generateTesting.determinePathOwnership(appSpec);

    expect(ownership.get("/orders/cart")).toBe("orders");
    expect(ownership.get("/orders/checkout")).toBe("orders");
    expect(ownership.has("/payments/webhook")).toBe(false);
  });

  it("builds dev proxy config only for TS services and uses primary port", () => {
    const appSpec: AppSpec = {
      product: { name: "Proxy App" },
      ui: { routes: [] },
      locators: {},
      flows: [],
      services: {
        Orders: { language: "typescript", ports: [{ port: 4000 }] },
        Payments: { language: "python", ports: [{ port: 5001 }] },
      },
    } as unknown as AppSpec;

    const ownership = new Map<string, string>([
      ["/orders/cart", "orders"],
      ["/payments/webhook", "payments"],
    ]);

    const proxies = __generateTesting.buildDevProxyConfig(appSpec, ownership);

    expect(proxies).toHaveProperty("/orders");
    expect(proxies["/orders"].target).toBe("http://127.0.0.1:4000");
    expect(proxies).not.toHaveProperty("/payments");
  });

  it("derives flow route metadata with test ids and api interactions", () => {
    const appSpec: AppSpec = {
      product: { name: "Flows" },
      ui: { routes: [{ id: "checkout", path: "/checkout" }] },
      locators: {
        "button:submit": 'data-testid="submit-btn"',
        "page:checkout": 'data-testid="checkout-root"',
      },
      flows: [
        {
          id: "checkout",
          steps: [
            { click: "button:submit" },
            { expect: { locator: "page:checkout" } },
            {
              expect_api: {
                method: "post",
                path: "/api/checkout",
                status: 201,
              },
            },
            {
              expect_api: {
                method: "post",
                path: "/api/checkout",
              },
            },
          ],
        },
      ],
      services: {},
    } as unknown as AppSpec;

    const metadata = __generateTesting.deriveFlowRouteMetadata(appSpec);
    const checkout = metadata.get("checkout");

    expect(checkout?.rootTestId).toBe("checkout-root");
    expect(checkout?.successTestId).toBe("checkout-root");
    expect(checkout?.actionTestIds).toContain("submit-btn");
    expect(checkout?.apiInteractions).toEqual([
      { method: "POST", path: "/api/checkout", status: 201 },
    ]);
  });

  it("extracts test ids and detects service aliases in paths", () => {
    const locators = { "page:main": 'data-testid="main-page"' };
    expect(__generateTesting.extractTestId("page:main", locators)).toBe("main-page");
    expect(__generateTesting.sanitizeTestId("Hello World!")).toBe("hello-world");
    expect(__generateTesting.humanizeTestId("hello-world")).toBe("Hello World");

    const serviceSpec = {
      capabilities: [{ contractRef: "payments.billing@1.0.0" }],
      domains: ["billing"],
    };

    expect(
      __generateTesting.pathBelongsToService("/payments/refund", "billing-service", serviceSpec),
    ).toBe(true);
    expect(
      __generateTesting.pathBelongsToService("/billing/webhook", "billing-service", serviceSpec),
    ).toBe(true);
    expect(__generateTesting.pathBelongsToService("/unknown", "billing-service", serviceSpec)).toBe(
      false,
    );
  });
});
