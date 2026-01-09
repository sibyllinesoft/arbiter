/**
 * @packageDocumentation
 * Authentication session storage utilities.
 *
 * Provides functions for persisting and retrieving authentication
 * sessions in the user's home directory.
 */

import os from "node:os";
import path from "node:path";
import type { AuthSession } from "@/types.js";
import fs from "fs-extra";

/**
 * Resolve the authentication file path.
 * @returns Object with authDir and authFile paths
 */
const resolveAuthFile = () => {
  const authDir = path.join(os.homedir(), ".arbiter");
  return {
    authDir,
    authFile: path.join(authDir, "auth.json"),
  };
};

/** Stored authentication session type alias. */
export interface StoredAuthSession extends AuthSession {}

/**
 * Load the stored authentication session.
 * @returns Promise resolving to AuthSession or null if not found
 */
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

/**
 * Save an authentication session to disk.
 * @param session - AuthSession to persist
 */
export async function saveAuthSession(session: AuthSession): Promise<void> {
  const { authDir, authFile } = resolveAuthFile();
  await fs.ensureDir(authDir);
  await fs.writeJSON(authFile, session, { spaces: 2 });
}

/**
 * Clear the stored authentication session.
 */
export async function clearAuthSession(): Promise<void> {
  try {
    const { authFile } = resolveAuthFile();
    await fs.remove(authFile);
  } catch {
    // Ignore errors when clearing auth session
  }
}

/**
 * Get the path to the authentication storage file.
 * @returns Absolute path to auth.json
 */
export function getAuthStorePath(): string {
  return resolveAuthFile().authFile;
}
