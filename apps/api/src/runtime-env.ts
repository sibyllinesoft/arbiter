export function isCloudflareRuntime(): boolean {
  if (typeof globalThis === "undefined") {
    return false;
  }

  const globalAny = globalThis as any;

  if (typeof globalAny.__ARB_CLOUDFLARE_RUNTIME__ === "boolean") {
    return Boolean(globalAny.__ARB_CLOUDFLARE_RUNTIME__);
  }

  // Cloudflare Workers expose WebSocketPair and lack process by default
  const hasWebSocketPair = typeof globalAny.WebSocketPair === "function";
  const hasProcess = typeof globalAny.process !== "undefined";
  const navigatorUserAgent = globalAny.navigator?.userAgent;
  const isWorkerUserAgent =
    typeof navigatorUserAgent === "string" &&
    navigatorUserAgent.toLowerCase().includes("cloudflare-workers");

  if (hasWebSocketPair && !hasProcess) {
    return true;
  }

  if (isWorkerUserAgent) {
    return true;
  }

  if (typeof globalAny.CLOUDFLARE_WORKER !== "undefined") {
    return true;
  }

  return false;
}
