import os from "node:os";
import path from "node:path";
import { __generateTesting, createClientTarget } from "@/services/generate/index.js";
import fs from "fs-extra";
import { describe, expect, it } from "vitest";

const baseStructure = {
  clientsDirectory: "clients",
  servicesDirectory: "services",
  packagesDirectory: "packages",
  toolsDirectory: "tools",
  docsDirectory: "docs",
  testsDirectory: "tests",
  infraDirectory: "infra",
  packageRelative: { testsDirectory: false, docsDirectory: false, infraDirectory: false },
};

const options = { dryRun: false } as any;

describe("generate structure helpers", () => {
  it("creates base directories unless dryRun", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-struct-"));
    await __generateTesting.ensureBaseStructure(baseStructure as any, tmp, options);

    const expectedDirs = ["clients", "services", "packages", "tools", "docs", "tests", "infra"];
    for (const dir of expectedDirs) {
      expect(await fs.pathExists(path.join(tmp, dir))).toBe(true);
    }

    const tmpDry = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-struct-"));
    await __generateTesting.ensureBaseStructure(baseStructure as any, tmpDry, {
      dryRun: true,
    } as any);
    for (const dir of expectedDirs) {
      expect(await fs.pathExists(path.join(tmpDry, dir))).toBe(false);
    }
  });

  it("enhances client dev server config with proxy entries", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-vite-"));
    const clientRoot = path.join(tmp, "clients", "web");
    await fs.ensureDir(clientRoot);
    const vitePath = path.join(clientRoot, "vite.config.ts");
    await fs.writeFile(vitePath, "export default {}\n");

    const appSpec: any = {
      product: { name: "App" },
      services: { Orders: { language: "typescript", ports: [{ port: 4000 }] } },
      paths: { Orders: { "/orders/cart": {} } },
      ui: { routes: [] },
      locators: {},
      flows: [],
    };

    const clientTarget = createClientTarget("web", {} as any, baseStructure as any, tmp);

    await __generateTesting.enhanceClientDevServer(appSpec, clientTarget, { dryRun: false } as any);

    const rewritten = await fs.readFile(vitePath, "utf-8");
    expect(rewritten).toContain("proxy");
    expect(rewritten).toContain("/orders");
    expect(rewritten).toContain("4000");
  });
});
