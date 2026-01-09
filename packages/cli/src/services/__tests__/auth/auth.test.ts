import { describe, expect, it, spyOn } from "bun:test";
import os from "node:os";
import path from "node:path";
import * as store from "@/io/api/auth-store.js";
import { runAuthCommand } from "@/services/auth/index.js";
import fs from "fs-extra";

const baseConfig = {
  apiUrl: "http://localhost:5050",
  timeout: 1,
  format: "json",
  color: false,
  localMode: true,
  projectDir: process.cwd(),
  projectStructure: {
    clientsDirectory: "clients",
    servicesDirectory: "services",
    packagesDirectory: "packages",
    toolsDirectory: "tools",
    docsDirectory: "docs",
    testsDirectory: "tests",
    infraDirectory: "infra",
  },
} as any;

describe("runAuthCommand", () => {
  it("logs out by clearing session", async () => {
    const prevHome = process.env.HOME;
    const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "arb-auth-"));
    const homeSpy = spyOn(os, "homedir").mockReturnValue(tmpHome);
    const authPath = path.join(tmpHome, ".arbiter", "auth.json");
    await fs.ensureDir(path.dirname(authPath));
    await fs.writeFile(authPath, "{}", "utf-8");

    const logSpy: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => logSpy.push(String(m));

    await runAuthCommand({ logout: true }, baseConfig);

    console.log = orig;
    expect(await fs.pathExists(authPath)).toBeFalse();
    expect(logSpy.join("")).toContain("Logged out");

    process.env.HOME = prevHome;
    homeSpy.mockRestore();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("short-circuits when OAuth is disabled", async () => {
    const fetchSpy = spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false }),
    } as any);

    const logSpy: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => logSpy.push(String(m));

    await runAuthCommand({}, baseConfig);

    console.log = orig;
    fetchSpy.mockRestore();
    expect(logSpy.join("")).toContain("OAuth is not enabled");
  });
});
