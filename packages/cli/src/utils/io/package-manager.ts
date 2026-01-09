import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";
const PKG_PLACEHOLDER = "__PKG__";

export interface PackageManagerCommandSet {
  name: PackageManager;
  install: string;
  installGlobal: (pkg: string) => string;
  run: (script: string) => string;
  exec: (binary: string, args?: string) => string;
}

export function detectPackageManager(
  userAgent = process.env.npm_config_user_agent,
  rootDir: string = process.cwd(),
): PackageManager {
  const detected =
    detectFromLockfiles(rootDir) ?? detectFromUserAgent(userAgent) ?? detectFromPath(rootDir);
  return detected ?? "npm";
}

function detectFromUserAgent(userAgent?: string | null): PackageManager | undefined {
  if (!userAgent) return undefined;
  if (userAgent.startsWith("bun")) return "bun";
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  return undefined;
}

function detectFromLockfiles(rootDir: string): PackageManager | undefined {
  if (existsSync(path.join(rootDir, "bun.lockb"))) return "bun";
  if (existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  return undefined;
}

function detectFromPath(_rootDir: string): PackageManager | undefined {
  if (commandExists("bun")) return "bun";
  if (commandExists("pnpm")) return "pnpm";
  if (commandExists("yarn")) return "yarn";
  return undefined;
}

function commandExists(cmd: string): boolean {
  try {
    execSync(process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`, {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function getPackageManagerCommands(pm: PackageManager): PackageManagerCommandSet {
  const withArgs = (base: string, args?: string): string =>
    args && args.trim().length > 0 ? `${base} ${args.trim()}` : base;

  switch (pm) {
    case "bun":
      return {
        name: pm,
        install: "bun install",
        installGlobal: (pkg) => `bun add --global ${pkg}`,
        run: (script) => `bun run ${script}`,
        exec: (binary, args) => withArgs(`bunx ${binary}`, args),
      };
    case "pnpm":
      return {
        name: pm,
        install: "pnpm install",
        installGlobal: (pkg) => `pnpm add -g ${pkg}`,
        run: (script) => `pnpm run ${script}`,
        exec: (binary, args) => withArgs(`pnpm exec ${binary}`, args),
      };
    case "yarn":
      return {
        name: pm,
        install: "yarn install",
        installGlobal: (pkg) => `yarn global add ${pkg}`,
        run: (script) => `yarn ${script}`,
        exec: (binary, args) => withArgs(`yarn ${binary}`, args),
      };
    default:
      const homePrefix =
        process.platform === "win32" ? undefined : `"${process.env.HOME || "~"}/.local"`;
      const globalInstall = homePrefix
        ? `npm install -g ${PKG_PLACEHOLDER} --prefix ${homePrefix}`
        : `npm install -g ${PKG_PLACEHOLDER}`;

      return {
        name: pm,
        install: "npm install",
        installGlobal: (pkg) => globalInstall.replace(PKG_PLACEHOLDER, pkg),
        run: (script) => `npm run ${script}`,
        exec: (binary, args) => withArgs(`npm exec -- ${binary}`, args),
      };
  }
}
