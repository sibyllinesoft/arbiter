import { describe, expect, it } from "bun:test";
import { addRoute } from "@/services/add/subcommands/route";

describe("addRoute helper", () => {
  const fakeManipulator = {
    addRoute: async (_content: string, cfg: any) => JSON.stringify(cfg),
  };

  it("builds route config with defaults", async () => {
    const result = await addRoute(fakeManipulator, "", "/billing", {});
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe("billing:main");
    expect(parsed.capabilities).toEqual(["view"]);
    expect(parsed.path).toBe("/billing");
  });

  it("respects custom id, capabilities, and components", async () => {
    const result = await addRoute(fakeManipulator, "", "/orders/list", {
      id: "orders:list",
      capabilities: "read,write",
      components: "table,filter",
    });
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe("orders:list");
    expect(parsed.capabilities).toEqual(["read", "write"]);
    expect(parsed.components).toEqual(["table", "filter"]);
  });
});
