import { afterAll, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { IdempotencyValidator } from "../constraints/idempotency.js";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-idem-"));
const cacheFile = path.join(tempRoot, ".arbiter", "cache", "idempotency.json");

afterAll(() => {
  fs.removeSync(tempRoot);
});

describe("IdempotencyValidator persistence", () => {
  it("persists cache to disk and reloads across instances", async () => {
    const validator = new IdempotencyValidator(tempRoot);
    const executor = async (input: string) => `${input}-out`;

    const result = await validator.validateIdempotency("generate", "sample", executor);
    expect(result).toBe("sample-out");

    // Cache file should be written
    expect(fs.existsSync(cacheFile)).toBe(true);

    const payload = fs.readJsonSync(cacheFile);
    expect(Array.isArray(payload.records)).toBe(true);
    expect(payload.records.length).toBe(1);
    expect(payload.records[0].operation).toBe("generate");

    // New instance should load existing cache into memory
    const second = new IdempotencyValidator(tempRoot);
    const stats = second.getValidationStats();
    expect(stats.cacheSize).toBe(1);
  });
});
