import { describe, expect, it } from "bun:test";
import { addLoadBalancer } from "@/services/add/subcommands/runtime/load-balancer";

const manipulator = {
  parse: async () => ({ services: { api: {} } }),
  addService: async (_c: string, name: string, cfg: any) => JSON.stringify({ name, cfg }),
  serialize: async (_ast: any, content: string) => content,
};

describe("addLoadBalancer helper", () => {
  it("adds load balancer service targeting an existing service", async () => {
    const res = await addLoadBalancer(manipulator, "", { target: "api" });
    const parsed = JSON.parse(res);
    expect(parsed.name).toBe("loadbalancer");
    expect(parsed.cfg.image).toBe("nginx:alpine");
  });
});
