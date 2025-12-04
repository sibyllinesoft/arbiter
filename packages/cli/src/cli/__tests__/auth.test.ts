import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import * as authStore from "@/auth-store.js";
import { createAuthCommand } from "@/cli/auth.js";
import * as authService from "@/services/auth/index.js";

const minimalConfig = {
  apiUrl: "https://api",
  timeout: 1,
  format: "json",
  color: false,
  localMode: true,
  projectDir: process.cwd(),
  projectStructure: {
    clientsDirectory: "clients",
    servicesDirectory: "services",
    packagesDirectory: "packages",
    toolsDirectory: "tools",
    docsDirectory: "docs",
    testsDirectory: "tests",
    infraDirectory: "infra",
  },
} as const;

describe("auth CLI", () => {
  it("prints status when authenticated", async () => {
    const program = new Command();
    // Commander stores config on the root command
    (program as any).config = minimalConfig;
    createAuthCommand(program);

    const session = {
      metadata: { provider: "github", clientId: "abc" },
      expiresAt: Date.now() + 60_000,
      scope: "openid profile",
    } as any;

    const sessionSpy = spyOn(authStore, "loadAuthSession").mockResolvedValue(session);
    const pathSpy = spyOn(authStore, "getAuthStorePath").mockReturnValue("/tmp/store.json");
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["auth", "--status"], { from: "user" });

    expect(sessionSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Authenticated"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Client ID: abc"));

    sessionSpy.mockRestore();
    pathSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("delegates to auth service when no status flag", async () => {
    const program = new Command();
    (program as any).config = minimalConfig;
    createAuthCommand(program);

    const runSpy = spyOn(authService, "runAuthCommand").mockResolvedValue(undefined as any);

    await program.parseAsync(["auth"], { from: "user" });

    expect(runSpy).toHaveBeenCalledWith({ outputUrl: false }, minimalConfig);
    runSpy.mockRestore();
  });
});
