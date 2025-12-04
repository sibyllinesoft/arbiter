import { describe, expect, it, spyOn } from "bun:test";
import { renameCommand } from "@/services/rename/index.js";
import * as smart from "@/utils/smart-naming.js";

describe("renameCommand", () => {
  it("exits early when nothing to migrate", async () => {
    spyOn(smart, "detectNamingPreferences").mockResolvedValue({ projectName: "demo" } as any);
    const resolveSpy = spyOn(smart, "resolveSmartNaming").mockReturnValue({
      projectSlug: "demo",
      configPrefix: "demo",
      surfacePrefix: "demo",
    } as any);
    const migrateSpy = spyOn(smart, "migrateExistingFiles").mockResolvedValue([]);

    const code = await renameCommand({ dryRun: true }, {} as any);
    expect(code).toBe(0);

    resolveSpy.mockRestore();
    migrateSpy.mockRestore();
  });
});
