/**
 * Data extraction utilities for architecture flow graph
 */
import { pickArray, pickRecord } from "./helpers";

export type ExtractedData = {
  resolvedFrontends: unknown[];
  components: Record<string, unknown>;
  componentEntries: Array<[string, unknown]>;
  services: Record<string, unknown>;
  databases: Record<string, unknown>;
  artifacts: unknown[];
};

/** Extract all relevant data from resolved spec */
export function extractResolvedData(resolved: Record<string, unknown>): ExtractedData {
  const spec = resolved?.spec as Record<string, unknown> | undefined;

  const resolvedFrontends = pickArray(resolved, ["frontend", "frontends", "ui"])
    .flatMap((entry) => {
      const e = entry as Record<string, unknown> | undefined;
      return Array.isArray(e?.packages) ? e.packages : [];
    })
    .concat(pickArray((resolved as Record<string, unknown>)?.frontend as unknown, ["packages"]))
    .concat(
      pickArray(spec, ["frontend"])?.flatMap((f) => {
        const fe = f as Record<string, unknown> | undefined;
        return (fe?.packages as unknown[]) ?? [];
      }) ?? [],
    );

  const components = {
    ...pickRecord(resolved, ["components"]),
    ...pickRecord(spec, ["components"]),
  };

  const componentEntries: Array<[string, unknown]> = Object.entries(components);

  const services = {
    ...pickRecord(resolved, ["services"]),
    ...pickRecord(spec, ["services"]),
  };

  const databases = {
    ...pickRecord(resolved, ["databases"]),
    ...pickRecord(spec, ["databases"]),
  };

  const artifacts = pickArray(resolved, ["artifacts", "artifact"]).concat(
    pickArray(spec, ["artifacts", "artifact"]),
  );

  return {
    resolvedFrontends,
    components,
    componentEntries,
    services,
    databases,
    artifacts,
  };
}
