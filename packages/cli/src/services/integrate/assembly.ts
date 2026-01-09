/**
 * @packageDocumentation
 * Assembly configuration parser for the integrate command.
 *
 * Provides functionality to:
 * - Read assembly configuration from CUE files
 * - Parse language and profile settings
 * - Extract build matrix configuration
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { AssemblyConfig, BuildMatrix } from "@/services/integrate/types.js";

export async function readAssemblyConfig(projectPath: string): Promise<AssemblyConfig | null> {
  const assemblyPath = path.join(projectPath, "arbiter.assembly.cue");

  try {
    await fs.access(assemblyPath);
    const content = await fs.readFile(assemblyPath, "utf-8");
    return parseAssemblyConfig(content);
  } catch {
    return null;
  }
}

export function parseAssemblyConfig(content: string): AssemblyConfig {
  const languageMatch = content.match(/language:\s*"([^"]+)"/);
  const language = languageMatch?.[1] || "typescript";

  const profileMatch = content.match(/profile:\s*"([^"]+)"/);
  const profileType = profileMatch?.[1] || "library";

  const buildMatrix = parseBuildMatrix(content);
  if (buildMatrix) {
    return { buildMatrix, language, profile: profileType };
  }

  return {
    buildMatrix: getDefaultBuildMatrixForProfile(profileType, language),
    language,
    profile: profileType,
  };
}

const VERSION_PATTERNS = [
  /nodeVersions:\s*\[(.*?)\]/,
  /pythonVersions:\s*\[(.*?)\]/,
  /rustVersions:\s*\[(.*?)\]/,
  /goVersions:\s*\[(.*?)\]/,
] as const;

function parseLanguageVersions(matrixContent: string): string[] {
  for (const pattern of VERSION_PATTERNS) {
    const match = matrixContent.match(pattern);
    if (match) {
      return parseVersionArray(match[1]);
    }
  }
  return [];
}

function parseArrayField(
  matrixContent: string,
  fieldPattern: RegExp,
  defaultValue: string[],
): string[] {
  const match = matrixContent.match(fieldPattern);
  return match ? parseVersionArray(match[1]) : defaultValue;
}

export function parseBuildMatrix(content: string): BuildMatrix | undefined {
  const buildMatrixSection = content.match(/buildMatrix:\s*\{([^}]+)\}/);
  if (!buildMatrixSection) {
    return undefined;
  }

  const matrixContent = buildMatrixSection[1];
  const versions = parseLanguageVersions(matrixContent);
  if (versions.length === 0) {
    return undefined;
  }

  return {
    versions,
    os: parseArrayField(matrixContent, /os:\s*\[(.*?)\]/, [
      "ubuntu-latest",
      "macos-latest",
      "windows-latest",
    ]),
    arch: parseArrayField(matrixContent, /arch:\s*\[(.*?)\]/, ["x64"]),
  };
}

interface LanguageVersionConfig {
  library: string[];
  default: string[];
}

const LANGUAGE_VERSIONS: Record<string, LanguageVersionConfig> = {
  typescript: { library: ["18", "20", "22"], default: ["20", "latest"] },
  javascript: { library: ["18", "20", "22"], default: ["20", "latest"] },
  python: { library: ["3.9", "3.10", "3.11", "3.12"], default: ["3.11", "3.12"] },
  rust: { library: ["stable", "beta"], default: ["stable"] },
  go: { library: ["1.21", "1.22", "1.23"], default: ["1.22", "1.23"] },
};

export function getDefaultBuildMatrixForProfile(
  profileType: string,
  language: string,
): BuildMatrix {
  const config = LANGUAGE_VERSIONS[language];
  const versions = config
    ? profileType === "library"
      ? config.library
      : config.default
    : ["latest"];

  return {
    versions,
    os: ["ubuntu-latest", "macos-latest", "windows-latest"],
    arch: ["x64"],
  };
}

function parseVersionArray(arrayContent: string): string[] {
  return arrayContent
    .split(",")
    .map((value) => value.trim().replace(/["']/g, ""))
    .filter((value) => value.length > 0);
}

export { parseVersionArray };
