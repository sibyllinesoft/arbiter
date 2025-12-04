import { describe, expect, it } from "bun:test";
import { addDatabase } from "@/services/add/subcommands/database";

const manipulator = {
  addDatabase: async (_c: string, name: string, cfg: any) => JSON.stringify({ name, cfg }),
};

describe("addDatabase helper", () => {
  it("creates database config with defaults when no template/serviceType provided", async () => {
    const res = await addDatabase(manipulator, "", "users", {
      engine: "postgres",
      username: "dbuser",
      password: "secret",
    });
    const parsed = JSON.parse(res);
    expect(parsed.name).toBe("users");
    expect(parsed.cfg.type).toBe("external");
    expect(parsed.cfg.image).toBe("postgres:15");
    expect(parsed.cfg.env.POSTGRES_USER).toBe("users_user");
    expect(parsed.cfg.ports[0].port).toBe(5432);
  });
});
