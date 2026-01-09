import { describe, expect, it } from "bun:test";
import { addCache } from "@/services/add/subcommands/runtime/cache";

const manipulator = {
  addService: async (_c: string, name: string, cfg: any) => JSON.stringify({ name, cfg }),
};

describe("addCache helper", () => {
  it("creates cache config with defaults", async () => {
    const res = await addCache(manipulator, "", "redis-cache", { engine: "redis", size: "1Gi" });
    const parsed = JSON.parse(res);
    expect(parsed.name).toBe("redis-cache");
    expect(parsed.cfg.type).toBe("external");
    expect(parsed.cfg.image).toBe("redis:7-alpine");
    expect(parsed.cfg.ports[0].port).toBe(6379);
  });
});
