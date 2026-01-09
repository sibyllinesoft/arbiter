import { describe, expect, it } from "bun:test";
import { parseGitUrl } from "../git/git-url";

describe("parseGitUrl", () => {
  it("parses ssh github urls", () => {
    const parsed = parseGitUrl("git@github.com:owner/repo.git");
    expect(parsed).toEqual({
      provider: "github",
      owner: "owner",
      repo: "repo",
    });
  });

  it("parses https github urls with ref", () => {
    const parsed = parseGitUrl("https://github.com/acme/demo/tree/feature/foo");
    expect(parsed?.owner).toBe("acme");
    expect(parsed?.repo).toBe("demo");
    expect(parsed?.ref).toBe("feature/foo");
  });

  it("rejects non-github hosts", () => {
    expect(parseGitUrl("https://gitlab.com/acme/demo.git")).toBeNull();
    expect(parseGitUrl("git@example.com:acme/demo.git")).toBeNull();
  });
});
