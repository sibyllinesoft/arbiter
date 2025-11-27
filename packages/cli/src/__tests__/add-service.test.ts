import { describe, expect, it } from "bun:test";
import { addService } from "../services/add/subcommands/service";

const manipulator = {
  addService: async (_c: string, _n: string, cfg: any) => JSON.stringify({ svc: cfg }),
  // For these helpers we just want to propagate existing content so later steps don't
  // clobber the service config we asserted on above.
  addRoute: async (content: string, _route: any) => content,
  addToSection: async (content: string) => content,
  parse: async () => ({ services: { orders: {} } }),
  serialize: async (_ast: any, content: string) => content,
};

describe("addService helper", () => {
  it("builds internal service when no image/template provided", async () => {
    const res = await addService(manipulator, "", "orders", { port: 4000, language: "typescript" });
    const parsed = JSON.parse(res);
    expect(parsed.svc.language).toBe("typescript");
  });

  it("builds external container service when image provided", async () => {
    const res = await addService(manipulator, "", "redis", { image: "redis:latest", port: 6379 });
    const parsed = JSON.parse(res);
    expect(parsed.svc.type).toBe("external");
    expect(parsed.svc.image).toBe("redis:latest");
  });
});
