import { describe, expect, it, spyOn } from "bun:test";
import * as smart from "../../utils/smart-naming.js";
import { renameCommand } from "../rename/index.js";

describe("renameCommand conflict path", () => {
  it("fails when destination exists and force is false", async () => {
    spyOn(smart, "detectNamingPreferences").mockResolvedValue({ projectName: "demo" } as any);
    spyOn(smart, "resolveSmartNaming").mockReturnValue({
      projectSlug: "demo",
      configPrefix: "demo",
      surfacePrefix: "demo",
    } as any);

    const proposed = [{ from: "old.cue", to: "demo.assembly.cue", exists: true }];
    const migrateSpy = spyOn(smart, "migrateExistingFiles").mockResolvedValueOnce(proposed as any); // dry run proposed

    const code = await renameCommand({ apply: true, force: false }, {} as any);
    expect(code).toBe(1);
    migrateSpy.mockRestore();
  });
});
