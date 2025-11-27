import fs from "node:fs/promises";
import path from "node:path";
import type { AssemblyConfig, BuildMatrix } from "./types.js";

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

export function parseBuildMatrix(content: string): BuildMatrix | undefined {
  const buildMatrixSection = content.match(/buildMatrix:\s*\{([^}]+)\}/);
  if (!buildMatrixSection) {
    return undefined;
  }

  const matrixContent = buildMatrixSection[1];
  const matrix: BuildMatrix = {
    versions: [],
    os: ["ubuntu-latest", "macos-latest", "windows-latest"],
    arch: ["x64"],
  };

  const nodeVersions = matrixContent.match(/nodeVersions:\s*\[(.*?)\]/);
  const pythonVersions = matrixContent.match(/pythonVersions:\s*\[(.*?)\]/);
  const rustVersions = matrixContent.match(/rustVersions:\s*\[(.*?)\]/);
  const goVersions = matrixContent.match(/goVersions:\s*\[(.*?)\]/);

  if (nodeVersions) {
    matrix.versions = parseVersionArray(nodeVersions[1]);
  } else if (pythonVersions) {
    matrix.versions = parseVersionArray(pythonVersions[1]);
  } else if (rustVersions) {
    matrix.versions = parseVersionArray(rustVersions[1]);
  } else if (goVersions) {
    matrix.versions = parseVersionArray(goVersions[1]);
  }

  const osMatch = matrixContent.match(/os:\s*\[(.*?)\]/);
  if (osMatch) {
    matrix.os = parseVersionArray(osMatch[1]);
  }

  const archMatch = matrixContent.match(/arch:\s*\[(.*?)\]/);
  if (archMatch) {
    matrix.arch = parseVersionArray(archMatch[1]);
  }

  return matrix.versions.length > 0 ? matrix : undefined;
}

export function getDefaultBuildMatrixForProfile(
  profileType: string,
  language: string,
): BuildMatrix {
  const baseMatrix: BuildMatrix = {
    versions: [],
    os: ["ubuntu-latest", "macos-latest", "windows-latest"],
    arch: ["x64"],
  };

  switch (language) {
    case "typescript":
    case "javascript":
      baseMatrix.versions = profileType === "library" ? ["18", "20", "22"] : ["20", "latest"];
      break;
    case "python":
      baseMatrix.versions =
        profileType === "library" ? ["3.9", "3.10", "3.11", "3.12"] : ["3.11", "3.12"];
      break;
    case "rust":
      baseMatrix.versions = profileType === "library" ? ["stable", "beta"] : ["stable"];
      break;
    case "go":
      baseMatrix.versions = profileType === "library" ? ["1.21", "1.22", "1.23"] : ["1.22", "1.23"];
      break;
    default:
      baseMatrix.versions = ["latest"];
  }

  return baseMatrix;
}

function parseVersionArray(arrayContent: string): string[] {
  return arrayContent
    .split(",")
    .map((value) => value.trim().replace(/["']/g, ""))
    .filter((value) => value.length > 0);
}

export { parseVersionArray };
