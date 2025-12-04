import { beforeEach, describe, expect, it } from "bun:test";
import { ArtifactClassifier } from "../../detection/classifier";
import { buildDirectoryContexts } from "../../detection/context-aggregator";
import type { Evidence, InferenceContext, ParseContext } from "../../types";
import { PythonPlugin } from "../python";

describe("PythonPlugin", () => {
  let plugin: PythonPlugin;
  let baseParseContext: ParseContext;

  beforeEach(() => {
    plugin = new PythonPlugin();
    baseParseContext = {
      projectRoot: "/project",
      fileIndex: {
        root: "/project",
        files: new Map(),
        directories: new Map(),
        timestamp: Date.now(),
      },
      options: {
        deepAnalysis: false,
        targetLanguages: [],
        maxFileSize: 1024 * 1024,
        includeBinaries: false,
        patterns: { include: ["**/*"], exclude: [] },
      },
      cache: new Map(),
    };
  });

  const buildInferenceContext = (evidence: Evidence[]): InferenceContext => {
    const classifier = new ArtifactClassifier();
    const directoryContexts = buildDirectoryContexts(
      evidence,
      baseParseContext.fileIndex,
      baseParseContext.projectRoot ?? "/project",
    );

    return {
      projectRoot: "/project",
      fileIndex: baseParseContext.fileIndex,
      allEvidence: evidence,
      directoryContexts,
      classifier,
      options: {
        minConfidence: 0.3,
        inferRelationships: true,
        maxDependencyDepth: 5,
        useHeuristics: true,
      },
      cache: new Map(),
      projectMetadata: {
        name: "project",
        root: "/project",
        languages: [],
        frameworks: [],
        fileCount: 0,
        totalSize: 0,
      },
    };
  };

  it("classifies FastAPI pyproject as service", async () => {
    const pyproject = `
[project]
name = "smith-http"
version = "0.1.0"
description = "HTTP gateway"
dependencies = ["fastapi", "uvicorn"]
`;

    const evidence = await plugin.parse(
      "/project/service/pyproject.toml",
      pyproject,
      baseParseContext,
    );

    const artifacts = await plugin.infer(evidence, buildInferenceContext(evidence));

    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0].artifact;
    expect(artifact.type).toBe("service");
    expect((artifact.metadata as any).framework).toBe("fastapi");
    expect((artifact.metadata as any).classification).toBeDefined();
    expect(artifact.description).toBe("HTTP gateway");
  });

  it("classifies setup.py with console scripts as binary tool", async () => {
    const setupPy = `
from setuptools import setup

setup(
    name="smith-cli",
    version="0.2.0",
    description="CLI for smith",
    install_requires=["click"],
    entry_points={
        "console_scripts": {
            "smith": "smith_cli.__main__:main"
        }
    }
)
`;

    const evidence = await plugin.parse("/project/tools/setup.py", setupPy, baseParseContext);
    const artifacts = await plugin.infer(evidence, buildInferenceContext(evidence));

    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0].artifact;
    expect(artifact.type).toBe("tool");
    expect(artifact.tags).toContain("tool");
    expect((artifact.metadata as any).classification).toBeDefined();
  });

  it("defaults to module when no web or cli signals present", async () => {
    const pyproject = `
[project]
name = "smith-library"
version = "0.3.1"
description = "Shared utilities"
dependencies = ["pydantic"]
`;

    const evidence = await plugin.parse(
      "/project/shared/pyproject.toml",
      pyproject,
      baseParseContext,
    );

    const artifacts = await plugin.infer(evidence, buildInferenceContext(evidence));

    expect(artifacts).toHaveLength(1);
    const artifact = artifacts[0].artifact;
    expect(artifact.type).toBe("package");
    expect((artifact.metadata as any).classification).toBeDefined();
    expect(artifact.description).toBe("Shared utilities");
  });
});
