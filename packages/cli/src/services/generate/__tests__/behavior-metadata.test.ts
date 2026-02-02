import { describe, expect, it } from "bun:test";
import type { AppSpec } from "@arbiter/specification";

import {
  deriveBehaviorRouteMetadata,
  extractTestId,
  humanizeTestId,
  sanitizeTestId,
} from "@/services/generate/io/index.js";

describe("generate helpers - flow metadata", () => {
  it("derives flow metadata including root, actions, success, and API interactions", () => {
    const appSpec: AppSpec = {
      product: { name: "Behaviors" },
      ui: { routes: [{ id: "home:main" }] },
      locators: {
        "page:home": 'data-testid="home-root"',
        "btn:purchase": 'data-testid="purchase-btn"',
      },
      entities: {
        "home:purchase": {
          type: "behavior",
          id: "home:purchase",
          steps: [
            { click: "btn:purchase" },
            { expect: { locator: "page:home" } },
            { expect_api: { path: "/api/pay", method: "post", status: 201 } },
          ],
        },
      },
    };

    const metadata = deriveBehaviorRouteMetadata(appSpec);
    const entry = metadata.get("home:main");
    expect(entry).toBeDefined();
    expect(entry?.rootTestId).toBe("home-root");
    expect(entry?.successTestId).toBe("home-root");
    expect(entry?.actionTestIds).toContain("purchase-btn");
    expect(entry?.apiInteractions).toEqual([{ method: "POST", path: "/api/pay", status: 201 }]);
  });

  it("extracts and humanizes test identifiers from diverse selectors", () => {
    expect(extractTestId('div[data-testid="hello-world"]', {})).toBe("hello-world");
    expect(extractTestId("page:settings/main", {})).toBe("settings-main");
    expect(extractTestId(".btn.primary", {})).toBe("btn-primary");
    expect(sanitizeTestId(" Hello  World ")).toBe("hello-world");
    expect(humanizeTestId("hello-world")).toBe("Hello World");
  });
});
