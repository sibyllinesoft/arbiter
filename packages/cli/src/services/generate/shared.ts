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
