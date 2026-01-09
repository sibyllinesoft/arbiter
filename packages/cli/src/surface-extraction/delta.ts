import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol } from "@/surface-extraction/types.js";
import type { SurfaceOutput } from "@/types/output.js";

type VersionBump = "MAJOR" | "MINOR" | "PATCH";

function symbolMatches(a: APISymbol, b: APISymbol): boolean {
  return a.name === b.name && a.type === b.type;
}

function findMatchingSymbol(symbols: APISymbol[], target: APISymbol): APISymbol | undefined {
  return symbols.find((s) => symbolMatches(s, target));
}

function parseExistingSurface(content: string): APISurface | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed.kind === "Surface" && parsed.surface) {
      return {
        language: parsed.language,
        version: parsed.surface.version || "unknown",
        timestamp: parsed.timestamp,
        symbols: parsed.surface.symbols,
        statistics: parsed.surface.statistics,
      };
    }
    return parsed;
  } catch {
    return null;
  }
}

function findAddedSymbols(current: APISymbol[], existing: APISymbol[]): APISymbol[] {
  return current.filter((symbol) => !findMatchingSymbol(existing, symbol));
}

function findRemovedSymbols(current: APISymbol[], existing: APISymbol[]): APISymbol[] {
  return existing.filter((symbol) => !findMatchingSymbol(current, symbol));
}

function findModifiedSymbols(current: APISymbol[], existing: APISymbol[]): APISymbol[] {
  return current.filter((symbol) => {
    const match = findMatchingSymbol(existing, symbol);
    return match && match.signature !== symbol.signature;
  });
}

function isBreakingChange(symbol: APISymbol, existing: APISymbol): boolean {
  const visibilityReduced = existing.visibility === "public" && symbol.visibility !== "public";
  const returnTypeChanged = existing.returnType !== symbol.returnType;
  return visibilityReduced || returnTypeChanged;
}

function hasBreakingChanges(
  modified: APISymbol[],
  existing: APISymbol[],
  removedCount: number,
): boolean {
  if (removedCount > 0) return true;
  return modified.some((symbol) => {
    const match = findMatchingSymbol(existing, symbol);
    return match && isBreakingChange(symbol, match);
  });
}

function determineRequiredBump(
  breaking: boolean,
  removedCount: number,
  addedCount: number,
): VersionBump {
  if (breaking || removedCount > 0) return "MAJOR";
  if (addedCount > 0) return "MINOR";
  return "PATCH";
}

export async function calculateSurfaceDelta(
  surface: APISurface,
  outputPath: string,
): Promise<SurfaceOutput["delta"] | undefined> {
  try {
    const existingContent = await readFile(outputPath, "utf-8").catch(() => null);
    if (!existingContent) return undefined;

    const existingSurface = parseExistingSurface(existingContent);
    if (!existingSurface) return undefined;

    const added = findAddedSymbols(surface.symbols, existingSurface.symbols);
    const removed = findRemovedSymbols(surface.symbols, existingSurface.symbols);
    const modified = findModifiedSymbols(surface.symbols, existingSurface.symbols);
    const breaking = hasBreakingChanges(modified, existingSurface.symbols, removed.length);
    const requiredBump = determineRequiredBump(breaking, removed.length, added.length);

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
