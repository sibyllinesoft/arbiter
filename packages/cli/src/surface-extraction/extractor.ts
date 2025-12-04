import type { APISurface, SurfaceLanguage, SurfaceOptions } from "@/surface-extraction/types.js";

export interface SurfaceExtractor {
  readonly language: SurfaceLanguage;
  extract(options: SurfaceOptions, sourceFiles: string[]): Promise<APISurface | null>;
}
