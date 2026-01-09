import { extractBashSurface } from "@/surface-extraction/extractors/bash-extractor.js";
import { extractGoSurface } from "@/surface-extraction/extractors/go-extractor.js";
import { extractPythonSurface } from "@/surface-extraction/extractors/python-extractor.js";
import { extractRustSurface } from "@/surface-extraction/extractors/rust-extractor.js";
import { extractTypeScriptSurface } from "@/surface-extraction/extractors/typescript-extractor.js";
import type { APISurface, SurfaceLanguage, SurfaceOptions } from "@/surface-extraction/types.js";

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
