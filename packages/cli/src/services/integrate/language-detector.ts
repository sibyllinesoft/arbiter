import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectLanguage } from "@/services/integrate/types.js";

export async function detectProjectLanguages(projectPath: string): Promise<ProjectLanguage[]> {
  const languages: ProjectLanguage[] = [];

  await Promise.all([
    detectNode(projectPath, languages),
    detectPython(projectPath, languages),
    detectRust(projectPath, languages),
    detectGo(projectPath, languages),
  ]);

  return languages;
}

async function detectNode(projectPath: string, collector: ProjectLanguage[]): Promise<void> {
  const packageJsonPath = path.join(projectPath, "package.json");
  try {
    const packageContent = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(packageContent);
    collector.push({
      name: "typescript",
      detected: true,
      files: ["package.json"],
      framework: pkg.dependencies?.next
        ? "next"
        : pkg.dependencies?.react
          ? "react"
          : pkg.dependencies?.vue
            ? "vue"
            : "node",
    });
  } catch {
    // No package.json found
  }
}

async function detectPython(projectPath: string, collector: ProjectLanguage[]): Promise<void> {
  const pyprojectPath = path.join(projectPath, "pyproject.toml");
  const requirementsPath = path.join(projectPath, "requirements.txt");

  try {
    await fs.access(pyprojectPath);
    collector.push({
      name: "python",
      detected: true,
      files: ["pyproject.toml"],
      framework: "python",
    });
    return;
  } catch {
    // Continue checking requirements.txt
  }

  try {
    await fs.access(requirementsPath);
    collector.push({
      name: "python",
      detected: true,
      files: ["requirements.txt"],
      framework: "python",
    });
  } catch {
    // Not a Python project
  }
}

async function detectRust(projectPath: string, collector: ProjectLanguage[]): Promise<void> {
  const cargoPath = path.join(projectPath, "Cargo.toml");
  try {
    await fs.access(cargoPath);
    collector.push({
      name: "rust",
      detected: true,
      files: ["Cargo.toml"],
      framework: "rust",
    });
  } catch {
    // Not a Rust project
  }
}

async function detectGo(projectPath: string, collector: ProjectLanguage[]): Promise<void> {
  const goModPath = path.join(projectPath, "go.mod");
  try {
    await fs.access(goModPath);
    collector.push({
      name: "go",
      detected: true,
      files: ["go.mod"],
      framework: "go",
    });
  } catch {
    // Not a Go project
  }
}
