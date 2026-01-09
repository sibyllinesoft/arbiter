import { describe, expect, it } from "bun:test";
import { addEndpoint } from "@/services/add/subcommands/runtime/endpoint";

const manipulator = {
  parse: async (_c: string) => ({ services: { api: {} } }),
  addEndpoint: async (_c: string, cfg: any) => JSON.stringify(cfg),
  addRoute: async (_c: string, cfg: any) => JSON.stringify(cfg),
  addToSection: async (_c: string, _section: string, k: string, v: any) => JSON.stringify({ k, v }),
  serialize: async (_ast: any, content: string) => content,
};

describe("addEndpoint helper", () => {
  it("builds endpoint config with defaults", async () => {
    const res = await addEndpoint(manipulator, "", "orders/get", {
      method: "GET",
      path: "/orders",
    });
    const parsed = JSON.parse(res);
    expect(parsed.service).toBe("api");
    expect(parsed.method).toBe("GET");
  });
});
