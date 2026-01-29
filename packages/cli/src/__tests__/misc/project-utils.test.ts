import { describe, expect, it } from "bun:test";
import { deriveProjectName } from "@/utils/api/project";

describe("project utils", () => {
  it("derives project name from directory", () => {
    const name = deriveProjectName({ projectDir: "/tmp/my-app" } as any);
    expect(name).toBe("my-app");
  });

  it("falls back to cwd basename when directory is empty", () => {
    const name = deriveProjectName({ projectDir: "" } as any);
    // When projectDir is empty, function uses process.cwd() basename
    expect(name.length).toBeGreaterThan(0);
  });
});
