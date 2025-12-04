import os from "node:os";
import path from "node:path";
import { __generateTesting } from "@/services/generate/index.js";
import type { AppSpec } from "@arbiter/shared";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";

describe("enhanceClientDevServer", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it("injects proxy configuration for detected service ownership", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-devserver-"));
    process.chdir(tempDir);

    const clientRoot = path.join(tempDir, "clients", "web");
    await fs.ensureDir(clientRoot);
    const viteConfigPath = path.join(clientRoot, "vite.config.ts");
    await fs.writeFile(viteConfigPath, "// initial vite config\n");

    const appSpec: AppSpec = {
      product: { name: "Proxy App" },
      ui: { routes: [] },
      locators: {},
      flows: [],
      services: {
        Orders: { language: "typescript", ports: [{ port: 4100 }] },
      },
      paths: {
        Orders: {
          "/orders/cart": {},
        },
      },
    } as unknown as AppSpec;

    const target = {
      key: "web",
      slug: "web",
      relativeRoot: "clients/web",
      config: {},
      context: {
        root: clientRoot,
        routesDir: path.join(clientRoot, "src", "routes"),
        testsDir: path.join(clientRoot, "tests"),
      },
    } as any;

    await __generateTesting.enhanceClientDevServer(appSpec, target, { dryRun: false } as any);

    const updated = await fs.readFile(viteConfigPath, "utf-8");
    expect(updated).toContain("proxy");
    expect(updated).toContain("/orders");
    expect(updated).toContain("4100");
  });
});
