/** Check if explicit runtime flag is set */
function hasExplicitFlag(g: any): boolean | null {
  if (typeof g.__ARB_CLOUDFLARE_RUNTIME__ === "boolean") {
    return Boolean(g.__ARB_CLOUDFLARE_RUNTIME__);
  }
  return null;
}

/** Check for Cloudflare Workers environment markers */
function hasCloudflareMarkers(g: any): boolean {
  // Cloudflare Workers expose WebSocketPair and lack process by default
  const hasWebSocketPair = typeof g.WebSocketPair === "function";
  const hasProcess = typeof g.process !== "undefined";
  if (hasWebSocketPair && !hasProcess) return true;

  // Check navigator user agent
  const navigatorUserAgent = g.navigator?.userAgent;
  if (
    typeof navigatorUserAgent === "string" &&
    navigatorUserAgent.toLowerCase().includes("cloudflare-workers")
  ) {
    return true;
  }

  // Check for explicit worker flag
  if (typeof g.CLOUDFLARE_WORKER !== "undefined") return true;

  return false;
}

/** Detect if running in Cloudflare Workers runtime */
export function isCloudflareRuntime(): boolean {
  if (typeof globalThis === "undefined") return false;

  const explicitFlag = hasExplicitFlag(globalThis);
  if (explicitFlag !== null) return explicitFlag;

  return hasCloudflareMarkers(globalThis);
}
