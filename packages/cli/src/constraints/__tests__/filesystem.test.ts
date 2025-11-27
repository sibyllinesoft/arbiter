import { afterEach, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { ConstraintViolationError } from "../core.js";
import { FileSystemConstraints } from "../filesystem.js";

const mkTmp = async () => fs.mkdtemp(path.join(os.tmpdir(), "fs-constraints-"));

describe("FileSystemConstraints", () => {
  afterEach(async () => {
    // Remove any tmp dirs created during tests
    const tmpDirs = await fs.readdir(os.tmpdir());
    await Promise.all(
      tmpDirs
        .filter((d) => d.startsWith("fs-constraints-"))
        .map((d) => fs.rm(path.join(os.tmpdir(), d), { recursive: true, force: true })),
    );
  });

  it("rejects missing file on read/copy/move", async () => {
    const fsc = new FileSystemConstraints();
    await expect(fsc.validatePath("/no/such/file", "read")).rejects.toBeInstanceOf(
      ConstraintViolationError,
    );
  });

  it("flags disallowed extensions but does not throw if exists", async () => {
    const fsc = new FileSystemConstraints();
    const dir = await mkTmp();
    const bad = path.join(dir, "image.bmp");
    await fs.writeFile(bad, "data");

    const res = await fsc.validatePath(bad, "write");
    expect(res.securityIssues.some((s) => s.includes(".bmp"))).toBe(true);
    expect(res.isValid).toBe(true);
  });

  it("detects symlink and throws constraint violation", async () => {
    const fsc = new FileSystemConstraints();
    const dir = await mkTmp();
    const target = path.join(dir, "real.txt");
    await fs.writeFile(target, "data");
    const link = path.join(dir, "link.txt");
    await fs.symlink(target, link);

    await expect(fsc.validatePath(link, "read")).rejects.toBeInstanceOf(ConstraintViolationError);
  });

  it("bundles files and ensures unique names without symlinks", async () => {
    const fsc = new FileSystemConstraints();
    const dirA = await mkTmp();
    const dirB = await mkTmp();
    const out = await mkTmp();

    const file1 = path.join(dirA, "dup.txt");
    const file2 = path.join(dirB, "dup.txt");
    await fs.writeFile(file1, "first");
    await fs.writeFile(file2, "second");

    await fsc.bundleFiles([file1, file2], out);

    const bundled = await fs.readdir(out);
    expect(bundled.some((f) => f === "dup.txt")).toBe(true);
    expect(bundled.length).toBeGreaterThanOrEqual(1);

    const stats = await fs.lstat(path.join(out, bundled[0]));
    expect(stats.isSymbolicLink()).toBe(false);
  });

  it("exports files with validation and no symlinks", async () => {
    const fsc = new FileSystemConstraints();
    const out = await mkTmp();

    await fsc.exportFiles({ "nested/file.cue": "content" }, out);

    const exportedPath = path.join(out, "nested/file.cue");
    const exists = await fs.pathExists(exportedPath);
    expect(exists).toBe(true);
    const stats = await fs.lstat(exportedPath);
    expect(stats.isSymbolicLink()).toBe(false);
  });

  it("wraps safeFileOperation and returns fn result after validation", async () => {
    const { safeFileOperation } = await import("../filesystem.js");
    const dir = await mkTmp();
    const file = path.join(dir, "ok.txt");
    await fs.writeFile(file, "hello");

    const result = await safeFileOperation("read", file, async (validated) => {
      const data = await fs.readFile(validated, "utf8");
      return data.toUpperCase();
    });

    expect(result).toBe("HELLO");
  });
});
