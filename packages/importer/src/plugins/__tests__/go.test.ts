import { describe, expect, it } from "bun:test";
import { goPlugin } from "../go";

const baseContext = { projectRoot: "/project" };

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
    const evidence = await goPlugin.parse("/project/go.mod", goMod, baseContext);
    const artifacts = await goPlugin.infer(evidence, baseContext as any);
    expect(artifacts[0].artifact.type).toBe("service");
    expect(artifacts[0].artifact.name).toBe("demo");
  });

  it("classifies CLI frameworks as binary", async () => {
    const goMod = `module cliapp
go 1.21
require (
\tgithub.com/spf13/cobra v1.8.0
)`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, baseContext);
    const artifacts = await goPlugin.infer(evidence, baseContext as any);
    expect(artifacts[0].artifact.type).toBe("binary");
  });

  it("defaults to package when no signals", async () => {
    const goMod = `module libapp
go 1.21
require ()`;
    const evidence = await goPlugin.parse("/project/go.mod", goMod, baseContext);
    const artifacts = await goPlugin.infer(evidence, baseContext as any);
    expect(artifacts[0].artifact.type).toBe("package");
  });
});
