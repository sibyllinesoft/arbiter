import { describe, expect, it } from "bun:test";
import { parseAppSchema } from "../index.js";

const baseSchema = {
  product: { name: "App" },
  services: { api: {} },
  capabilities: ["auth"],
  locators: { api: { url: "http://api" } },
};

describe("parseAppSchema", () => {
  it("fills defaults and normalizes capabilities", () => {
    const config = parseAppSchema(baseSchema, { version: "app", detected_from: "metadata" });

    expect(config.schema.version).toBe("app");
    expect(config.app.capabilities?.auth.name).toBe("auth");
    expect(config.app.ui.routes).toEqual([]);
  });

  it("passes through existing optional sections", () => {
    const schema = {
      ...baseSchema,
      tests: { suites: [] },
      epics: [{ name: "E" }],
      docs: { overview: "ok" },
    };

    const config = parseAppSchema(schema, { version: "app", detected_from: "metadata" });
    expect(config.app.tests?.suites).toEqual([]);
    expect(config.app.epics?.[0].name).toBe("E");
    expect(config.app.docs?.overview).toBe("ok");
  });
});
