import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import type { AuthSession } from "./types.js";

const AUTH_DIRECTORY = path.join(os.homedir(), ".arbiter");
const AUTH_FILE = path.join(AUTH_DIRECTORY, "auth.json");

export interface StoredAuthSession extends AuthSession {}

export async function loadAuthSession(): Promise<AuthSession | null> {
  try {
    if (!(await fs.pathExists(AUTH_FILE))) {
      return null;
    }

    const data = await fs.readJSON(AUTH_FILE);
    if (!data || typeof data !== "object") {
      return null;
    }

    return data as AuthSession;
  } catch {
    return null;
  }
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await fs.ensureDir(AUTH_DIRECTORY);
  await fs.writeJSON(AUTH_FILE, session, { spaces: 2 });
}

export async function clearAuthSession(): Promise<void> {
  try {
    await fs.remove(AUTH_FILE);
  } catch {
    // Ignore errors when clearing auth session
  }
}

export function getAuthStorePath(): string {
  return AUTH_FILE;
}
