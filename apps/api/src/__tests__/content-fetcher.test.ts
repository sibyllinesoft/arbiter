import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGithubContentFetcher, createLocalContentFetcher } from "../git/content-fetcher";

const tmp = () => mkdtemp(path.join(os.tmpdir(), "content-fetcher-"));

describe("createLocalContentFetcher", () => {
  it("reads files inside project root", async () => {
    const dir = await tmp();
    const filePath = path.join(dir, "hello.txt");
    await writeFile(filePath, "hello world");

    const fetcher = createLocalContentFetcher(dir);
    const result = await fetcher.fetchText("hello.txt");

    expect(result).toBe("hello world");
    await rm(dir, { recursive: true, force: true });
  });

  it("blocks parent-directory traversal", async () => {
    const dir = await tmp();
    const fetcher = createLocalContentFetcher(dir);

    const result = await fetcher.fetchText("../etc/passwd");
    expect(result).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects oversized files", async () => {
    const dir = await tmp();
    const filePath = path.join(dir, "big.bin");
    const big = Buffer.alloc(1024 * 1024, 1); // 1MB
    await writeFile(filePath, big);

    const fetcher = createLocalContentFetcher(dir, 1024); // 1KB limit
    const result = await fetcher.fetchText("big.bin");

    expect(result).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
});

describe("createGithubContentFetcher", () => {
  it("builds github raw urls and respects size checks", async () => {
    const fetchCalls: string[] = [];
    const originalFetch = globalThis.fetch;

    // Mock fetch to capture URL and respond with small payload
    globalThis.fetch = (async (url) => {
      fetchCalls.push(String(url));
      return new Response("data", {
        status: 200,
        headers: { "content-length": "4" },
      });
    }) as typeof fetch;

    const fetcher = createGithubContentFetcher({
      owner: "acme",
      repo: "demo",
      ref: "main",
    });

    const text = await fetcher.fetchText("src/index.ts");

    expect(text).toBe("data");
    expect(fetchCalls[0]).toContain(
      "https://raw.githubusercontent.com/acme/demo/main/src/index.ts",
    );

    globalThis.fetch = originalFetch;
  });
});
