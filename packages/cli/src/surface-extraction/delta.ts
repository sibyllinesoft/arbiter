import { readFile } from "node:fs/promises";
import type { APISurface } from "@/surface-extraction/types.js";
import type { SurfaceOutput } from "@/types/output.js";

export async function calculateSurfaceDelta(
  surface: APISurface,
  outputPath: string,
): Promise<SurfaceOutput["delta"] | undefined> {
  try {
    const existingContent = await readFile(outputPath, "utf-8").catch(() => null);
    if (!existingContent) {
      return undefined;
    }

    let existingSurface: APISurface;
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed.kind === "Surface" && parsed.surface) {
        existingSurface = {
          language: parsed.language,
          version: parsed.surface.version || "unknown",
          timestamp: parsed.timestamp,
          symbols: parsed.surface.symbols,
          statistics: parsed.surface.statistics,
        };
      } else {
        existingSurface = parsed;
      }
    } catch {
      return undefined;
    }

    const added = surface.symbols.filter(
      (symbol) =>
        !existingSurface.symbols.some(
          (existing) => existing.name === symbol.name && existing.type === symbol.type,
        ),
    );

    const removed = existingSurface.symbols.filter(
      (symbol) =>
        !surface.symbols.some(
          (current) => current.name === symbol.name && current.type === symbol.type,
        ),
    );

    const modified = surface.symbols.filter((symbol) => {
      const existing = existingSurface.symbols.find(
        (current) => current.name === symbol.name && current.type === symbol.type,
      );
      return existing && existing.signature !== symbol.signature;
    });

    const breaking =
      removed.length > 0 ||
      modified.some((symbol) => {
        const existing = existingSurface.symbols.find(
          (current) => current.name === symbol.name && current.type === symbol.type,
        );
        return (
          existing &&
          ((existing.visibility === "public" && symbol.visibility !== "public") ||
            existing.returnType !== symbol.returnType)
        );
      });

    let requiredBump: "MAJOR" | "MINOR" | "PATCH" = "PATCH";
    if (breaking || removed.length > 0) {
      requiredBump = "MAJOR";
    } else if (added.length > 0) {
      requiredBump = "MINOR";
    }

    return {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      breaking,
      requiredBump,
    };
  } catch {
    return undefined;
  }
}
