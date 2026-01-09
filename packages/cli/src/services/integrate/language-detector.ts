/**
 * @packageDocumentation
 * Language detection for the integrate command.
 *
 * Provides functionality to:
 * - Detect project languages by manifest files
 * - Identify TypeScript, Python, Go, Rust projects
 * - Detect frameworks like Bun, Node.js
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectLanguage } from "@/services/integrate/types.js";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectByManifest(
  projectPath: string,
  manifestFile: string,
  name: string,
  framework: string,
): Promise<ProjectLanguage | null> {
  const manifestPath = path.join(projectPath, manifestFile);
  if (await fileExists(manifestPath)) {
    return { name, detected: true, files: [manifestFile], framework };
  }
  return null;
}

function detectNodeFramework(dependencies?: Record<string, unknown>): string {
  if (!dependencies) return "node";
  if (dependencies.next) return "next";
  if (dependencies.react) return "react";
  if (dependencies.vue) return "vue";
  return "node";
}

async function detectNode(projectPath: string): Promise<ProjectLanguage | null> {
  const packageJsonPath = path.join(projectPath, "package.json");
  try {
    const packageContent = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(packageContent) as { dependencies?: Record<string, unknown> };
    return {
      name: "typescript",
      detected: true,
      files: ["package.json"],
      framework: detectNodeFramework(pkg.dependencies),
    };
  } catch {
    return null;
  }
}

async function detectPython(projectPath: string): Promise<ProjectLanguage | null> {
  const pyprojectResult = await detectByManifest(projectPath, "pyproject.toml", "python", "python");
  if (pyprojectResult) return pyprojectResult;

  return detectByManifest(projectPath, "requirements.txt", "python", "python");
}

async function detectRust(projectPath: string): Promise<ProjectLanguage | null> {
  return detectByManifest(projectPath, "Cargo.toml", "rust", "rust");
}

async function detectGo(projectPath: string): Promise<ProjectLanguage | null> {
  return detectByManifest(projectPath, "go.mod", "go", "go");
}

export async function detectProjectLanguages(projectPath: string): Promise<ProjectLanguage[]> {
  const results = await Promise.all([
    detectNode(projectPath),
    detectPython(projectPath),
    detectRust(projectPath),
    detectGo(projectPath),
  ]);

  return results.filter((lang): lang is ProjectLanguage => lang !== null);
}
