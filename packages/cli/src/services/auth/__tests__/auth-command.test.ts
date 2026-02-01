import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as authStore from "@/io/api/auth-store.js";
import { DEFAULT_PROJECT_STRUCTURE } from "@/io/config/config.js";
import { runAuthCommand } from "@/services/auth/index.js";
import type { CLIConfig } from "@/types.js";

function createConfig(): CLIConfig {
  return {
    apiUrl: "http://localhost:5050",
    timeout: 1_000,
    format: "json",
    color: false,
    localMode: true,
    projectDir: process.cwd(),
    projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
  };
}

describe("runAuthCommand", () => {
  let clearAuthSessionSpy: ReturnType<typeof spyOn>;
  let getAuthStorePathSpy: ReturnType<typeof spyOn>;
  let saveAuthSessionSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    clearAuthSessionSpy = spyOn(authStore, "clearAuthSession").mockResolvedValue(undefined);
    getAuthStorePathSpy = spyOn(authStore, "getAuthStorePath").mockReturnValue(
      "/tmp/auth-store.json",
    );
    saveAuthSessionSpy = spyOn(authStore, "saveAuthSession").mockResolvedValue(undefined);
  });

  afterEach(() => {
    clearAuthSessionSpy?.mockRestore();
    getAuthStorePathSpy?.mockRestore();
    saveAuthSessionSpy?.mockRestore();
  });

  it("logs out and clears stored credentials", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});

    await runAuthCommand({ logout: true }, createConfig());

    expect(clearAuthSessionSpy).toHaveBeenCalled();
    expect(getAuthStorePathSpy).toHaveBeenCalled();
    log.mockRestore();
  });

  it("prints authorization URL when --output-url is provided", async () => {
    const metadataResponse = {
      enabled: true,
      provider: "test",
      authorizationEndpoint: "https://auth/authorize",
      tokenEndpoint: "https://auth/token",
      clientId: "client",
      scopes: ["read"],
      redirectUri: "urn:ietf:wg:oauth:2.0:oob",
    };

    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        ({
          ok: true,
          json: async () => metadataResponse,
        }) as any,
    );

    const log = spyOn(console, "log").mockImplementation(() => {});

    await runAuthCommand({ outputUrl: true }, createConfig());

    expect(fetchSpy).toHaveBeenCalledTimes(1); // only metadata request
    expect(saveAuthSessionSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    log.mockRestore();
  });
});
