/** @packageDocumentation Utility tests */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("package-manager utilities", () => {
  let pkgModule: any;

  beforeEach(async () => {
    // Import with cache buster to ensure fresh module
    const timestamp = Date.now();
    pkgModule = await import(`@/utils/io/package-manager.js?t=${timestamp}`);
  });

  afterEach(() => {
    mock.restore();
  });

  it("prefers lockfiles over user agent and path detection", async () => {
    const { detectPackageManager } = pkgModule;
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pkgm-"));
    try {
      await fs.writeFile(path.join(tmp, "pnpm-lock.yaml"), "", "utf-8");

      const pm = detectPackageManager("yarn/4.0.0", tmp);

      expect(pm).toBe("pnpm"); // lockfile takes precedence
    } finally {
      await fs.rm(tmp, { recursive: true }).catch(() => {});
    }
  });

  it("detects from user agent when no locks exist", () => {
    const { detectPackageManager } = pkgModule;
    expect(detectPackageManager("bun/1.1.0")).toBe("bun");
    expect(detectPackageManager("pnpm/9.0.0")).toBe("pnpm");
    expect(detectPackageManager("yarn/4.2.0")).toBe("yarn");
  });

  it("falls back to PATH detection when no hints are provided", () => {
    const { detectPackageManager } = pkgModule;
    // Uses commandExists inside detectFromPath; Bun should be available in PATH in CI
    const pm = detectPackageManager(undefined, process.cwd());
    expect(pm).toBeDefined();
  });

  it("returns npm when user agent unknown and no binaries on PATH", async () => {
    mock.module("node:child_process", () => ({
      __esModule: true,
      execSync: () => {
        throw new Error("not found");
      },
    }));

    // Need fresh import after mocking
    const timestamp = Date.now();
    const { detectPackageManager } = await import(`@/utils/io/package-manager.js?npm=${timestamp}`);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "pkgm-unknown-"));
    try {
      const pm = detectPackageManager("unknown/1.0", tmp);
      expect(pm).toBe("npm");
    } finally {
      await fs.rm(tmp, { recursive: true }).catch(() => {});
    }
  });

  it("generates command set for bun and npm", () => {
    const { getPackageManagerCommands } = pkgModule;

    const bun = getPackageManagerCommands("bun");
    expect(bun.exec("lint", "--fix")).toBe("bunx lint --fix");
    expect(bun.installGlobal("cue")).toBe("bun add --global cue");

    const npm = getPackageManagerCommands("npm");
    expect(npm.run("build")).toBe("npm run build");
    expect(npm.exec("vite")).toContain("npm exec -- vite");
    expect(npm.installGlobal("cue")).toContain("npm install -g cue");

    const pnpm = getPackageManagerCommands("pnpm");
    expect(pnpm.installGlobal("cue")).toBe("pnpm add -g cue");
    expect(pnpm.exec("ts-node", "--project tsconfig.json")).toBe(
      "pnpm exec ts-node --project tsconfig.json",
    );

    const yarn = getPackageManagerCommands("yarn");
    expect(yarn.run("test")).toBe("yarn test");
    expect(yarn.installGlobal("cue")).toBe("yarn global add cue");
  });
});
