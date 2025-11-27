import { describe, expect, it } from "bun:test";
import { ensureProjectExists } from "../project";

const baseConfig = {
  projectDir: "/tmp/demo",
} as any;

describe("ensureProjectExists", () => {
  it("returns existing project id without creating", async () => {
    const client = {
      listProjects: async () => ({ success: true, data: [{ id: "cli-project" }] }),
      createProject: async () => ({ success: false }),
    } as any;

    const id = await ensureProjectExists(client, baseConfig);
    expect(id).toBe("cli-project");
  });

  it("creates project when missing and returns new id", async () => {
    const createdId = "new-proj";
    const client = {
      listProjects: async () => ({ success: true, data: [] }),
      createProject: async () => ({ success: true, data: { id: createdId } }),
    } as any;

    const id = await ensureProjectExists(client, baseConfig);
    expect(id).toBe(createdId);
  });

  it("throws when creation fails", async () => {
    const client = {
      listProjects: async () => ({ success: false, error: "unreachable" }),
      createProject: async () => ({ success: false, error: "boom" }),
    } as any;

    await expect(ensureProjectExists(client, baseConfig)).rejects.toThrow("boom");
  });
});
