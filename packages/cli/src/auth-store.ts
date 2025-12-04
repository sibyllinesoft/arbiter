import os from "node:os";
import path from "node:path";
import type { AuthSession } from "@/types.js";
import fs from "fs-extra";

const resolveAuthFile = () => {
  const authDir = path.join(os.homedir(), ".arbiter");
  return {
    authDir,
    authFile: path.join(authDir, "auth.json"),
  };
};

export interface StoredAuthSession extends AuthSession {}

export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    const { authFile } = resolveAuthFile();
    if (!(await fs.pathExists(authFile))) {
      return null;
    }

    const data = await fs.readJSON(authFile);
    if (!data || typeof data !== "object") {
      return null;
    }

    return data as AuthSession;
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  const { authDir, authFile } = resolveAuthFile();
  await fs.ensureDir(authDir);
  await fs.writeJSON(authFile, session, { spaces: 2 });
}

export async function clearAuthSession(): Promise<void> {
  try {
    const { authFile } = resolveAuthFile();
    await fs.remove(authFile);
  } catch {
    // Ignore errors when clearing auth session
  }
}

export function getAuthStorePath(): string {
  return resolveAuthFile().authFile;
}
