import { describe, expect, it } from "bun:test";
import { parseAppSchema } from "@/services/generate/io/index.js";
import { getBehaviorsArray, getGroups } from "@arbiter/specification";

const baseSchema = {
  product: { name: "App" },
  services: { api: {} },
  capabilities: ["auth"],
  locators: { api: { url: "http://api" } },
  ui: { routes: [] },
  behaviors: [],
};

describe("parseAppSchema", () => {
  it("fills defaults and normalizes capabilities", () => {
    const config = parseAppSchema(baseSchema, { version: "app", detected_from: "metadata" });

    expect(config.schema.version).toBe("app");
    expect(config.app.capabilities?.auth.name).toBe("auth");
    expect(getBehaviorsArray(config.app)).toEqual([]);
  });

  it("passes through existing optional sections", () => {
    const schema = {
      ...baseSchema,
      tests: { suites: [] },
      groups: { groupE: { name: "E" } },
      docs: { overview: "ok" },
    };

    const config = parseAppSchema(schema, { version: "app", detected_from: "metadata" });
    expect(config.app.tests?.suites).toEqual([]);
    const groups = getGroups(config.app);
    expect(groups.groupE?.name).toBe("E");
    expect(config.app.docs?.overview).toBe("ok");
  });
});
