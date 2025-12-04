import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { DEFAULT_PROJECT_STRUCTURE } from "@/config.js";
import { runAuthCommand } from "@/services/auth/index.js";
import type { CLIConfig } from "@/types.js";

const clearAuthSession = mock(async () => {});
const saveAuthSession = mock(async () => {});
const getAuthStorePath = mock(() => "/tmp/auth-store.json");

mock.module("@/auth-store.js", () => ({
  clearAuthSession,
  saveAuthSession,
  getAuthStorePath,
}));

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

afterEach(() => {
  mock.restore();
});

describe("runAuthCommand", () => {
  it("logs out and clears stored credentials", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});

    await runAuthCommand({ logout: true }, createConfig());

    expect(clearAuthSession).toHaveBeenCalled();
    expect(getAuthStorePath).toHaveBeenCalled();
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
    expect(saveAuthSession).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    log.mockRestore();
  });
});
