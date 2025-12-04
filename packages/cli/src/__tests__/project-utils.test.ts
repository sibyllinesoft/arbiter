import { describe, expect, it } from "bun:test";
import { deriveProjectName } from "@/utils/project";

describe("project utils", () => {
  it("derives project name from directory", () => {
    const name = deriveProjectName({ projectDir: "/tmp/my-app" } as any);
    expect(name).toBe("my-app");
  });

  it("falls back to default when directory is empty", () => {
    const name = deriveProjectName({ projectDir: "" } as any);
    expect(name).toBe("arbiter");
  });
});
