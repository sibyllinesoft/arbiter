/**
 * @packageDocumentation
 * Shared utilities for the code generation system.
 *
 * Provides path manipulation and file organization utilities
 * used across the generation pipeline.
 */

import path from "node:path";

export const PATH_SEPARATOR_REGEX = /[\\/]+/;

export function toPathSegments(value: string): string[] {
  return value.split(PATH_SEPARATOR_REGEX).filter(Boolean);
}

export function joinRelativePath(...parts: string[]): string {
  return parts
    .flatMap((part) => part.split(PATH_SEPARATOR_REGEX))
    .filter(Boolean)
    .join("/");
}

export function toRelativePath(from: string, to: string): string | null {
  const relative = path.relative(from, to);
  if (!relative || relative.trim().length === 0 || relative === ".") {
    return null;
  }
  const segments = toPathSegments(relative);
  return segments.length > 0 ? joinRelativePath(...segments) : null;
}

export function slugify(value: string | undefined, fallback = "app"): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return normalized.length > 0 ? normalized : fallback;
}
