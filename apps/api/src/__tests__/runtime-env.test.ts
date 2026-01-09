import { describe, expect, it } from "bun:test";
import { isCloudflareRuntime } from "../util/runtime-env";

describe("isCloudflareRuntime", () => {
  it("returns false in default node environment", () => {
    expect(isCloudflareRuntime()).toBe(false);
  });

  it("detects Cloudflare markers on global", () => {
    (globalThis as any).__ARB_CLOUDFLARE_RUNTIME__ = true;
    expect(isCloudflareRuntime()).toBe(true);
    delete (globalThis as any).__ARB_CLOUDFLARE_RUNTIME__;
  });

  it("detects Cloudflare WebSocketPair without process", () => {
    const originalProcess = (globalThis as any).process;
    (globalThis as any).process = undefined;
    (globalThis as any).WebSocketPair = function () {
      /* noop */
    };
    expect(isCloudflareRuntime()).toBe(true);
    delete (globalThis as any).WebSocketPair;
    (globalThis as any).process = originalProcess;
  });
});
