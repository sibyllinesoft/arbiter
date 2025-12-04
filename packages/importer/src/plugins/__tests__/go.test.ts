import { describe, expect, it } from "bun:test";
import { ArtifactClassifier } from "../../detection/classifier";
import { buildDirectoryContexts } from "../../detection/context-aggregator";
import type { InferenceContext } from "../../types";
import { goPlugin } from "../go";

const buildInferenceContext = (evidence: any[]): InferenceContext => {
  const projectRoot = "/project";
  const fileIndex = {
    root: projectRoot,
    files: new Map(),
    directories: new Map(),
    timestamp: Date.now(),
  };
  return {
    projectRoot,
    fileIndex,
    allEvidence: evidence as any[],
    directoryContexts: buildDirectoryContexts(evidence as any[], fileIndex as any, projectRoot),
    classifier: new ArtifactClassifier(),
    options: {
      minConfidence: 0.3,
      inferRelationships: true,
      maxDependencyDepth: 5,
      useHeuristics: true,
    },
    cache: new Map(),
    projectMetadata: {
      name: "project",
      root: projectRoot,
      languages: [],
      frameworks: [],
      fileCount: 0,
      totalSize: 0,
    },
  };
};

describe("GoPlugin", () => {
  it("supports go.mod and main.go", () => {
    expect(goPlugin.supports("/project/go.mod", "module demo")).toBe(true);
    expect(goPlugin.supports("/project/main.go", "package main")).toBe(true);
    expect(goPlugin.supports("/project/pkg/util.go", "package util")).toBe(false);
  });

  it("classifies web frameworks as service", async () => {
    const goMod = `module demo
go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.0
)`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, {
      projectRoot: "/project",
    } as any);
    const artifacts = await goPlugin.infer(evidence, buildInferenceContext(evidence));
    expect(artifacts[0].artifact.type).toBe("service");
    expect(artifacts[0].artifact.name).toBe("demo");
  });

  it("classifies CLI frameworks as binary", async () => {
    const goMod = `module cliapp
go 1.21
require (
\tgithub.com/spf13/cobra v1.8.0
)`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, {
      projectRoot: "/project",
    } as any);
    const artifacts = await goPlugin.infer(evidence, buildInferenceContext(evidence));
    expect(
      artifacts[0].artifact.type === "binary" || artifacts[0].artifact.type === "tool",
    ).toBeTrue();
  });

  it("defaults to package when no signals", async () => {
    const goMod = `module libapp
go 1.21
require ()`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, {
      projectRoot: "/project",
    } as any);
    const artifacts = await goPlugin.infer(evidence, buildInferenceContext(evidence));
    expect(artifacts[0].artifact.type).toBe("package");
  });
});
