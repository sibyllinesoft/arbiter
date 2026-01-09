/**
 * @module project-analysis/next-routes
 * Next.js route extraction utilities.
 */

import type { FrontendRouteInfo, NextRouteInfo } from "./types";

/**
 * Normalizes path separators to forward slashes.
 */
export function normalizeRelativePath(value: string): string {
  return value.replace(/\\+/g, "/");
}

/**
 * Extracts routes from Next.js pages and app directory conventions.
 */
export function extractNextRoutes(
  packageRelativeRoot: string,
  files: string[],
): FrontendRouteInfo[] {
  const routes: FrontendRouteInfo[] = [];
  const prefix =
    packageRelativeRoot && packageRelativeRoot !== "." ? `${packageRelativeRoot}/` : "";
  const seen = new Set<string>();

  for (const relative of files) {
    if (prefix && !relative.startsWith(prefix)) continue;
    const withinPackage = prefix ? relative.slice(prefix.length) : relative;
    const normalized = normalizeRelativePath(withinPackage);

    if (normalized.startsWith("node_modules/")) continue;

    if (normalized.startsWith("pages/")) {
      const routeInfo = deriveNextPagesRoute(normalized);
      if (routeInfo && !seen.has(routeInfo.key)) {
        seen.add(routeInfo.key);
        routes.push({
          path: routeInfo.path,
          filePath: prefix ? `${prefix}${routeInfo.relativeFile}` : routeInfo.relativeFile,
          routerType: "next",
          component: routeInfo.component,
          metadata: {
            kind: "next-pages",
            dynamic: routeInfo.dynamicSegments,
          },
        });
      }
    } else if (normalized.startsWith("app/")) {
      const routeInfo = deriveNextAppRoute(normalized);
      if (routeInfo && !seen.has(routeInfo.key)) {
        seen.add(routeInfo.key);
        routes.push({
          path: routeInfo.path,
          filePath: prefix ? `${prefix}${routeInfo.relativeFile}` : routeInfo.relativeFile,
          routerType: "next",
          component: routeInfo.component,
          metadata: {
            kind: "next-app",
            dynamic: routeInfo.dynamicSegments,
            segment: routeInfo.segment,
          },
        });
      }
    }
  }

  return routes;
}

/**
 * Derives route info from a Next.js pages directory file.
 */
function deriveNextPagesRoute(relativeFile: string): NextRouteInfo | null {
  if (!/\.(tsx|ts|jsx|js)$/i.test(relativeFile)) return null;
  if (relativeFile.endsWith(".d.ts")) return null;

  const withoutPrefix = relativeFile.replace(/^pages\//, "");
  const withoutExt = withoutPrefix.replace(/\.(tsx|ts|jsx|js)$/i, "");

  if (withoutExt === "_app" || withoutExt === "_document") return null;

  const segments = withoutExt.split("/").filter(Boolean);
  const dynamicSegments: string[] = [];
  const transformedSegments = segments.map((segment) =>
    transformNextSegment(segment, dynamicSegments),
  );
  const joined = transformedSegments.join("/");
  const pathValue =
    joined === "" || joined === "index" ? "/" : `/${joined.replace(/\/?index$/, "")}`;

  return {
    key: `${pathValue}@pages`,
    path: pathValue,
    component: withoutExt || "IndexPage",
    relativeFile,
    dynamicSegments,
  };
}

/**
 * Derives route info from a Next.js app directory file.
 */
function deriveNextAppRoute(relativeFile: string): NextRouteInfo | null {
  if (!/\.(tsx|ts|jsx|js)$/i.test(relativeFile)) return null;
  if (!relativeFile.endsWith("/page.tsx") && !relativeFile.endsWith("/page.ts")) return null;

  const withoutPrefix = relativeFile.replace(/^app\//, "");
  const withoutSuffix = withoutPrefix.replace(/\/page\.(tsx|ts)$/i, "");
  const segments = withoutSuffix.split("/").filter(Boolean);
  const dynamicSegments: string[] = [];
  const transformedSegments = segments.map((segment) =>
    transformNextSegment(segment, dynamicSegments),
  );
  const joined = transformedSegments.join("/");
  const pathValue = joined ? `/${joined}` : "/";

  return {
    key: `${pathValue}@app`,
    path: pathValue,
    component: segments.length ? segments[segments.length - 1] : "page",
    relativeFile,
    dynamicSegments,
    segment: withoutSuffix || "root",
  };
}

/**
 * Transforms Next.js dynamic route segments.
 */
function transformNextSegment(segment: string, dynamicSegments: string[]): string {
  if (!segment) return segment;
  if (segment.startsWith("[[...") && segment.endsWith("]]")) {
    const name = segment.slice(4, -2);
    dynamicSegments.push(name);
    return `:${name}*?`;
  }
  if (segment.startsWith("[...") && segment.endsWith("]")) {
    const name = segment.slice(4, -1);
    dynamicSegments.push(name);
    return `:${name}*`;
  }
  if (segment.startsWith("[") && segment.endsWith("]")) {
    const name = segment.slice(1, -1);
    dynamicSegments.push(name);
    return `:${name}`;
  }
  return segment;
}
