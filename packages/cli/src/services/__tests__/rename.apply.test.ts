import { describe, expect, it, spyOn } from "bun:test";
import { renameCommand } from "@/services/rename/index.js";
import * as smart from "@/utils/smart-naming.js";

describe("renameCommand apply path", () => {
  it("applies renames when --force is set", async () => {
    spyOn(smart, "detectNamingPreferences").mockResolvedValue({ projectName: "demo" } as any);
    spyOn(smart, "resolveSmartNaming").mockReturnValue({
      projectSlug: "demo",
      configPrefix: "demo",
      surfacePrefix: "demo",
    } as any);

    const proposedChanges = [{ from: "old.cue", to: "demo.assembly.cue", exists: true }];
    const appliedResults = [{ ...proposedChanges[0], success: true }];

    const migrateSpy = spyOn(smart, "migrateExistingFiles")
      .mockResolvedValueOnce(proposedChanges as any) // dry-run
      .mockResolvedValueOnce(appliedResults as any); // apply

    const code = await renameCommand({ apply: true, force: true }, {} as any);
    expect(code).toBe(0);
    expect(migrateSpy).toHaveBeenCalledTimes(2);

    migrateSpy.mockRestore();
  });
});
