import { describe, expect, it } from "bun:test";
import { GitHubTemplateAssetStrategy } from "@/templates/github-assets";

describe("GitHubTemplateAssetStrategy", () => {
  it("delegates resolution to the orchestrator with override and default dirs", async () => {
    const calls: any[] = [];
    const orchestrator = {
      async resolveTemplateAsset(templatePath: string, opts: any) {
        calls.push({ templatePath, opts });
        return { content: "ok", resolvedPath: `/resolved/${templatePath}` };
      },
    };

    const strategy = new GitHubTemplateAssetStrategy(orchestrator as any);
    const result = await strategy.resolve("actions/node.yml", {
      overrideDirectories: [".github/custom"],
      defaultDirectories: [".github/workflows"],
    });

    expect(result?.resolvedPath).toBe("/resolved/actions/node.yml");
    expect(calls[0]).toEqual({
      templatePath: "actions/node.yml",
      opts: {
        overrideDirectories: [".github/custom"],
        defaultDirectories: [".github/workflows"],
      },
    });
  });

  it("returns undefined when orchestrator cannot resolve", async () => {
    const strategy = new GitHubTemplateAssetStrategy({
      async resolveTemplateAsset() {
        return undefined;
      },
    } as any);

    const result = await strategy.resolve("missing.yml");
    expect(result).toBeUndefined();
  });
});
