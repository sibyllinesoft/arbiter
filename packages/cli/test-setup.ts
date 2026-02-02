/**
 * Test setup - ensures test isolation for process.env and process.cwd()
 * This file is preloaded before all tests to prevent pollution between test files.
 */
import { afterEach, beforeEach } from "bun:test";

// Store original state
const originalCwd = process.cwd();
const originalEnv = { ...process.env };

// Global hooks to restore state after each test
beforeEach(() => {
  // Reset to original cwd if it changed
  if (process.cwd() !== originalCwd) {
    try {
      process.chdir(originalCwd);
    } catch {
      // Ignore if directory doesn't exist
    }
  }
});

afterEach(() => {
  // Restore cwd
  if (process.cwd() !== originalCwd) {
    try {
      process.chdir(originalCwd);
    } catch {
      // Ignore if directory doesn't exist
    }
  }

  // Restore critical env vars that tests commonly modify
  const criticalVars = ["GITHUB_TOKEN", "ARBITER_GITHUB_TOKEN", "NODE_ENV", "CI"];

  for (const key of criticalVars) {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  }
});
