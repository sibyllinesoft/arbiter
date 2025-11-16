export type EnvironmentMap = Record<string, string>;

const KEY_VALUE_PATTERN = /^\s*([^=:\s]+)\s*(?:=|:)\s*(.*)$/;

const cleanValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && value && "value" in value) {
    const nested = (value as Record<string, unknown>).value;
    return cleanValue(nested);
  }
  return "";
};

const addEntry = (target: EnvironmentMap, key: unknown, value: unknown) => {
  if (typeof key !== "string") return;
  const normalizedKey = key.trim();
  if (!normalizedKey) return;
  target[normalizedKey] = cleanValue(value).trim();
};

const parseLine = (line: string): { key: string; value: string } | null => {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = KEY_VALUE_PATTERN.exec(trimmed);
  if (match) {
    const key = match[1]?.trim() ?? "";
    if (!key) return null;
    const value = (match[2] ?? "").trim();
    return { key, value };
  }
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace > 0) {
    const key = trimmed.slice(0, firstSpace).trim();
    const value = trimmed.slice(firstSpace + 1).trim();
    if (key) {
      return { key, value };
    }
  }
  return { key: trimmed, value: "" };
};

const addSource = (target: EnvironmentMap, source: unknown): void => {
  if (!source) return;
  if (Array.isArray(source)) {
    source.forEach((entry) => addSource(target, entry));
    return;
  }
  if (typeof source === "string") {
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const parsed = parseLine(line);
        if (parsed) {
          target[parsed.key] = parsed.value;
        }
      });
    return;
  }
  if (typeof source === "object") {
    Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
      if (value && typeof value === "object" && "key" in (value as Record<string, unknown>)) {
        const nested = value as Record<string, unknown>;
        addEntry(target, nested.key ?? key, nested.value);
      } else {
        addEntry(target, key, value);
      }
    });
  }
};

export const mergeEnvironmentSources = (...sources: unknown[]): EnvironmentMap => {
  const map: EnvironmentMap = {};
  sources.forEach((source) => addSource(map, source));
  return map;
};

export const environmentMapToMultiline = (map: EnvironmentMap): string => {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    return "";
  }
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");
};

export const parseEnvironmentText = (input: string): EnvironmentMap => {
  if (!input) return {};
  const map: EnvironmentMap = {};
  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parsed = parseLine(line);
      if (parsed) {
        map[parsed.key] = parsed.value;
      }
    });
  return map;
};
