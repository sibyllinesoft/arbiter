import { describe, expect, it } from "bun:test";

import {
  getDefaultBuildMatrixForProfile,
  parseAssemblyConfig,
  parseBuildMatrix,
  parseVersionArray,
} from "../assembly.js";

describe("integrate assembly helpers", () => {
  it("parses assembly content with explicit build matrix", () => {
    const content = `
    language: "python"
    profile: "service"
    buildMatrix: {
      pythonVersions: ["3.10","3.11"]
      os: ["ubuntu-latest"]
      arch: ["x64","arm64"]
    }`;

    const config = parseAssemblyConfig(content);
    expect(config.language).toBe("python");
    expect(config.buildMatrix?.versions).toEqual(["3.10", "3.11"]);
    expect(config.buildMatrix?.arch).toEqual(["x64", "arm64"]);
  });

  it("falls back to default matrix when none present", () => {
    const config = parseAssemblyConfig(`language: "go"\nprofile: "library"`);
    expect(config.buildMatrix.versions).toContain("1.22");
  });

  it("parseVersionArray trims and cleans quotes", () => {
    expect(parseVersionArray('"1","2" , " 3"')).toEqual(["1", "2", " 3"]);
  });

  it("parseBuildMatrix handles node version matrix", () => {
    const matrix = parseBuildMatrix(`buildMatrix: { nodeVersions: ["18","20"], os: ["ubuntu"] }`);
    expect(matrix?.versions).toEqual(["18", "20"]);
    expect(matrix?.os).toEqual(["ubuntu"]);
  });

  it("getDefaultBuildMatrixForProfile returns language-specific defaults", () => {
    expect(getDefaultBuildMatrixForProfile("library", "rust").versions).toContain("stable");
    expect(getDefaultBuildMatrixForProfile("service", "typescript").versions).toContain("latest");
  });
});
