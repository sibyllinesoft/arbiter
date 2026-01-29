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
  it("supports go.mod only", () => {
    expect(goPlugin.supports("/project/go.mod")).toBe(true);
    // Simplified plugin only parses go.mod - main.go and other source files are not supported
    expect(goPlugin.supports("/project/main.go")).toBe(false);
    expect(goPlugin.supports("/project/pkg/util.go")).toBe(false);
  });

  it("outputs package type for web frameworks (agents classify later)", async () => {
    const goMod = `module demo
go 1.21

require (
\tgithub.com/gin-gonic/gin v1.9.0
)`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, {
      projectRoot: "/project",
    } as any);
    const artifacts = await goPlugin.infer(evidence, buildInferenceContext(evidence));
    // Importer outputs "package" - agents determine if it's a service based on dependencies
    expect(artifacts[0].artifact.type).toBe("package");
    expect(artifacts[0].artifact.name).toBe("demo");
  });

  it("outputs package type for CLI frameworks (agents classify later)", async () => {
    const goMod = `module cliapp
go 1.21
require (
\tgithub.com/spf13/cobra v1.8.0
)`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, {
      projectRoot: "/project",
    } as any);
    const artifacts = await goPlugin.infer(evidence, buildInferenceContext(evidence));
    // Importer outputs "package" - agents determine if it's a tool based on dependencies
    expect(artifacts[0].artifact.type).toBe("package");
  });

  it("outputs package type when no signals", async () => {
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
