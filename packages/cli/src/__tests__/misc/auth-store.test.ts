import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  clearAuthSession,
  getAuthStorePath,
  loadAuthSession,
  saveAuthSession,
} from "@/io/api/auth-store.js";
import fs from "fs-extra";

const realHomedir = os.homedir;

const withTmpHome = async <T>(fn: (tmp: string) => Promise<T>): Promise<T> => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "auth-store-"));
  (os as any).homedir = () => tmp;
  try {
    return await fn(tmp);
  } finally {
    (os as any).homedir = realHomedir;
    await rm(tmp, { recursive: true, force: true });
  }
};

afterEach(async () => {
  // Ensure original homedir is restored even on test failure
  (os as any).homedir = realHomedir;
});

describe("auth-store", () => {
  it("saves and loads sessions from ~/.arbiter/auth.json", async () =>
    withTmpHome(async (tmp) => {
      const session = { token: "abc", user: "dev" };
      await saveAuthSession(session as any);

      const loaded = await loadAuthSession();
      expect(loaded).toEqual(session);

      const expectedPath = path.join(tmp, ".arbiter", "auth.json");
      expect(getAuthStorePath()).toBe(expectedPath);
      expect(await fs.pathExists(expectedPath)).toBe(true);
    }));

  it("clears stored sessions", async () =>
    withTmpHome(async () => {
      const session = { token: "abc", user: "dev" };
      await saveAuthSession(session as any);
      await clearAuthSession();

      const loaded = await loadAuthSession();
      expect(loaded).toBeNull();
    }));
});
