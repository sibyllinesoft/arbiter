/** @packageDocumentation Utility tests */
import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import {
  detectPlatform,
  getPlatformServiceDefaults,
} from "@/utils/util/core/platform-detection.js";

async function setupTempDir(files: Record<string, string | null>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "arbiter-platform-"));
  await Promise.all(
    Object.entries(files).map(async ([relative, content]) => {
      const target = path.join(dir, relative);
      if (content === null) {
        await fs.mkdir(target, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content, "utf-8");
      }
    }),
  );
  return dir;
}

describe("platform detection", () => {
  it("detects Cloudflare projects from config and dependencies", async () => {
    const tmp = await setupTempDir({
      "wrangler.toml": "name = 'demo'",
      "package.json": JSON.stringify({ dependencies: { wrangler: "^3.0.0" } }),
    });

    const result = await detectPlatform(tmp);

    expect(result.detected).toBe("cloudflare");
    expect(result.indicators).toEqual(
      expect.arrayContaining(["wrangler.toml found", "Cloudflare dependencies found"]),
    );
    expect(result.suggestions.find((s) => s.serviceType === "cloudflare_worker")).toBeDefined();

    await rm(tmp, { recursive: true, force: true });
  });

  it("detects Vercel projects using configuration and env vars", async () => {
    const tmp = await setupTempDir({
      "vercel.json": "{}",
      ".env": "VERCEL=1",
      "package.json": JSON.stringify({ devDependencies: { "@vercel/node": "^1.0.0" } }),
    });

    const result = await detectPlatform(tmp);

    expect(result.detected).toBe("vercel");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.suggestions.find((s) => s.serviceType === "vercel_edge_function")).toBeDefined();

    await rm(tmp, { recursive: true, force: true });
  });

  it("detects Supabase projects from directory and env hints", async () => {
    const tmp = await setupTempDir({
      supabase: null,
      ".env": "SUPABASE=true",
    });

    const result = await detectPlatform(tmp);

    expect(result.detected).toBe("supabase");
    expect(result.indicators).toEqual(
      expect.arrayContaining(["supabase/ directory found", "SUPABASE env vars found"]),
    );
    expect(result.suggestions.some((s) => s.serviceType === "supabase_functions")).toBe(true);

    await rm(tmp, { recursive: true, force: true });
  });

  it("falls back to kubernetes when signals are weak", async () => {
    const tmp = await setupTempDir({ api: null });

    const result = await detectPlatform(tmp);

    expect(result.detected).toBe("kubernetes");
    expect(result.confidence).toBeGreaterThan(0);

    await rm(tmp, { recursive: true, force: true });
  });

  it("provides platform defaults for known service types", () => {
    expect(getPlatformServiceDefaults("cloudflare_worker")).toMatchObject({
      platform: "cloudflare",
      workload: "serverless",
      runtime: "worker",
    });

    expect(getPlatformServiceDefaults("vercel_postgres")).toMatchObject({
      platform: "vercel",
      language: "sql",
    });

    expect(getPlatformServiceDefaults("supabase_functions")).toMatchObject({
      platform: "supabase",
      runtime: "deno",
    });
  });
});
