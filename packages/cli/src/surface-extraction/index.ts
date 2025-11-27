import { extractBashSurface } from "./bash-extractor.js";
import { extractGoSurface } from "./go-extractor.js";
import { extractPythonSurface } from "./python-extractor.js";
import { extractRustSurface } from "./rust-extractor.js";
import type { APISurface, SurfaceLanguage, SurfaceOptions } from "./types.js";
import { extractTypeScriptSurface } from "./typescript-extractor.js";

export type SurfaceExtractorFn = (
  options: SurfaceOptions,
  sourceFiles: string[],
) => Promise<APISurface | null>;

const defaultExtractors: Partial<Record<SurfaceLanguage, SurfaceExtractorFn>> = {
  typescript: extractTypeScriptSurface,
  python: extractPythonSurface,
  rust: extractRustSurface,
  go: extractGoSurface,
  bash: extractBashSurface,
};

export function getExtractor(language: SurfaceLanguage): SurfaceExtractorFn | undefined {
  return defaultExtractors[language];
}

export function registerExtractor(language: SurfaceLanguage, extractor: SurfaceExtractorFn): void {
  defaultExtractors[language] = extractor;
}

export function listExtractors(): SurfaceLanguage[] {
  return Object.keys(defaultExtractors) as SurfaceLanguage[];
}
