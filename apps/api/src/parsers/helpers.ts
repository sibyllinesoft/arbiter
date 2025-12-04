import { createHash } from "node:crypto";
import path from "node:path";

export const DOCKER_COMPOSE_FILES = new Set(["docker-compose.yml", "docker-compose.yaml"]);
export const PACKAGE_MANIFESTS = new Set(["package.json", "bunfig.toml"]);
export const DATABASE_HINTS = [
  "schema.prisma",
  "schema.sql",
  "migration.sql",
  "docker-compose.db",
  "docker-compose.database",
];
export const KUBERNETES_KEYWORDS = [
  "deployment",
  "statefulset",
  "daemonset",
  "service",
  "configmap",
  "secret",
  "ingress",
  "namespace",
];

export const ROUTE_HINT_PATTERN =
  /<Route\s|createBrowserRouter|createRoutesFromElements|react-router/;

export const NODE_WEB_FRAMEWORKS = [
  "express",
  "fastify",
  "koa",
  "hapi",
  "nest",
  "adonis",
  "meteor",
  "sails",
  "loopback",
  "restify",
  "hono",
];

export const NODE_FRONTEND_FRAMEWORKS = [
  "react",
  "react-dom",
  "next",
  "vue",
  "angular",
  "svelte",
  "solid-js",
  "preact",
  "nuxt",
  "gatsby",
];

export const NODE_CLI_FRAMEWORKS = [
  "commander",
  "yargs",
  "inquirer",
  "oclif",
  "meow",
  "cac",
  "clipanion",
];

export const TYPESCRIPT_SIGNALS = [
  "typescript",
  "ts-node",
  "ts-node-dev",
  "tsx",
  "tsup",
  "@swc/core",
];

export const TSOA_ROUTE_PATTERN = /controller|route|api/i;

export const RUST_WEB_FRAMEWORKS = [
  "axum",
  "warp",
  "actix-web",
  "rocket",
  "tide",
  "gotham",
  "nickel",
  "hyper",
  "poem",
  "salvo",
  "tower-web",
];

export const RUST_CLI_FRAMEWORKS = ["clap", "structopt", "argh", "gumdrop"];

export function normalizeSlashes(value: string): string {
  return value.replace(/\\+/g, "/");
}

export function collectPackageDependencies(pkg: any): Record<string, string> {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
}

export function detectPackageFrameworks(pkg: any): string[] {
  const deps = collectPackageDependencies(pkg);
  return NODE_WEB_FRAMEWORKS.filter((dep) => Boolean(deps[dep]));
}

export function packageUsesTypeScript(pkg: any): boolean {
  const deps = collectPackageDependencies(pkg);
  if (TYPESCRIPT_SIGNALS.some((signal) => Boolean(deps[signal]))) {
    return true;
  }

  if (typeof pkg.types === "string" || typeof pkg.typings === "string") {
    return true;
  }

  const scripts = pkg.scripts || {};
  const scriptSignals = ["ts-node", "tsx", "ts-node-dev", "tsup", "tsc"];
  return Object.values(scripts)
    .filter((command): command is string => typeof command === "string")
    .some((command) => scriptSignals.some((signal) => command.includes(signal)));
}

export function classifyPackageManifest(pkg: any): {
  type: "service" | "frontend" | "tool" | "package";
  detectedType: string;
  reason: string;
} {
  const deps = collectPackageDependencies(pkg);
  const depNames = Object.keys(deps).map((dep) => dep.toLowerCase());
  const runtimeDepNames = new Set<string>([
    ...Object.keys(pkg.dependencies || {}).map((dep) => dep.toLowerCase()),
    ...Object.keys(pkg.optionalDependencies || {}).map((dep) => dep.toLowerCase()),
    ...Object.keys(pkg.peerDependencies || {}).map((dep) => dep.toLowerCase()),
  ]);

  const hasRuntimeDependency = (candidates: string[]) =>
    candidates.some((candidate) => runtimeDepNames.has(candidate));
  const hasDependency = (candidates: string[]) =>
    candidates.some((candidate) => depNames.includes(candidate));

  if (hasRuntimeDependency(NODE_WEB_FRAMEWORKS)) {
    return {
      type: "service",
      detectedType: "web_service",
      reason: "web-framework",
    };
  }

  const hasFrontendFramework =
    hasRuntimeDependency(NODE_FRONTEND_FRAMEWORKS) || Boolean(pkg.browserslist);
  if (hasFrontendFramework) {
    return {
      type: "frontend",
      detectedType: "frontend",
      reason: "frontend-framework",
    };
  }

  const hasBin = Boolean(
    typeof pkg.bin === "string" || (pkg.bin && Object.keys(pkg.bin).length > 0),
  );
  const hasCliDependency = hasDependency(NODE_CLI_FRAMEWORKS);
  if (hasBin || hasCliDependency) {
    return {
      type: "tool",
      detectedType: "tool",
      reason: hasBin ? "manifest-bin" : "cli-dependency",
    };
  }

  return {
    type: "package",
    detectedType: "package",
    reason: "default-module",
  };
}

export function detectNodePackageLanguage(pkg: any): string | null {
  const deps = collectPackageDependencies(pkg);
  const depNames = new Set<string>(Object.keys(deps).map((dep) => dep.toLowerCase()));
  const scripts = Object.values(pkg.scripts || {}).filter(
    (value): value is string => typeof value === "string",
  );
  const scriptBlob = scripts.join(" ").toLowerCase();

  const hasTypeScriptSignal =
    TYPESCRIPT_SIGNALS.some((signal) => depNames.has(signal)) ||
    /(?:\btsc\b|ts-node|tsx|typescript)/.test(scriptBlob) ||
    (typeof pkg.types === "string" && pkg.types.endsWith(".d.ts")) ||
    (typeof pkg.typings === "string" && pkg.typings.endsWith(".d.ts")) ||
    (typeof pkg.main === "string" && pkg.main.endsWith(".ts")) ||
    (typeof pkg.module === "string" && pkg.module.endsWith(".ts"));

  if (hasTypeScriptSignal) {
    return "TypeScript";
  }

  return null;
}

function normalizeCargoDependencyName(name: string): string {
  return name.toLowerCase().replace(/_/g, "-");
}

export function collectCargoDependencyNames(cargo: any): string[] {
  const sections = ["dependencies", "dev-dependencies", "build-dependencies"];
  const names = new Set<string>();

  for (const section of sections) {
    const deps = cargo?.[section];
    if (!deps || typeof deps !== "object") continue;
    for (const key of Object.keys(deps)) {
      names.add(normalizeCargoDependencyName(key));
    }
  }

  return Array.from(names);
}

export function extractCargoBinaryNames(binSection: unknown): string[] {
  if (!binSection) return [];

  if (Array.isArray(binSection)) {
    return binSection
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && typeof (entry as any).name === "string") {
          return (entry as any).name as string;
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));
  }

  if (typeof binSection === "object") {
    const name = (binSection as Record<string, unknown>).name;
    if (typeof name === "string") {
      return [name];
    }
  }

  return [];
}

export function classifyCargoManifest(options: {
  dependencyNames: string[];
  hasBinaries: boolean;
  hasLibrary: boolean;
}): {
  type: "service" | "package" | "tool";
  detectedType: "service" | "package" | "binary";
  reason: string;
  framework?: string;
} {
  const { dependencyNames, hasBinaries } = options;
  const normalizedDeps = dependencyNames.map(normalizeCargoDependencyName);

  const findMatch = (candidates: string[]): string | undefined => {
    return candidates.find((candidate) => normalizedDeps.includes(candidate));
  };

  const webFramework = findMatch(RUST_WEB_FRAMEWORKS);
  if (webFramework) {
    return {
      type: "service",
      detectedType: "service",
      reason: "web-framework",
      framework: webFramework,
    };
  }

  if (hasBinaries) {
    const cliFramework = findMatch(RUST_CLI_FRAMEWORKS);
    return {
      type: "tool",
      detectedType: "binary",
      reason: cliFramework ? "cli-binary" : "binary-target",
      framework: cliFramework,
    };
  }

  return {
    type: "package",
    detectedType: "package",
    reason: options.hasLibrary ? "library-target" : "default-module",
  };
}

export function stripPackageRoot(filePath: string, packageRoot: string): string {
  if (!packageRoot) return filePath;
  if (filePath === packageRoot) return "";
  if (filePath.startsWith(`${packageRoot}/`)) {
    return filePath.slice(packageRoot.length + 1);
  }
  return filePath;
}

export function buildTsoaAnalysisFromPackage(
  packageJsonPath: string,
  pkg: any,
  allFiles: string[],
): {
  root: string;
  frameworks: string[];
  usesTypeScript: true;
  hasTsoaDependency: boolean;
  totalTypeScriptFiles: number;
  controllerCandidates: string[];
  configFiles: string[];
  scriptsUsingTsoa: string[];
  recommendedCommands: string[];
} | null {
  const frameworks = detectPackageFrameworks(pkg);
  if (frameworks.length === 0) return null;
  if (!packageUsesTypeScript(pkg)) return null;

  const packageDir = normalizeSlashes(path.dirname(packageJsonPath));
  const normalizedRoot = packageDir === "." ? "" : packageDir;
  const deps = collectPackageDependencies(pkg);
  const hasTsoaDependency = Boolean(deps.tsoa);
  const scripts = pkg.scripts || {};

  const relevantFiles = allFiles
    .map(normalizeSlashes)
    .filter((file) => {
      if (file.endsWith(".d.ts")) return false;
      if (!normalizedRoot) {
        return !file.startsWith("node_modules/");
      }
      return file === normalizedRoot || file.startsWith(`${normalizedRoot}/`);
    })
    .map((file) => stripPackageRoot(file, normalizedRoot))
    .filter((rel) => rel && !rel.startsWith("node_modules/"));

  if (relevantFiles.length === 0) {
    return null;
  }

  const tsFiles = relevantFiles.filter((rel) => /\.(ts|tsx)$/i.test(rel));
  if (tsFiles.length === 0) {
    return null;
  }

  const controllerCandidates = tsFiles
    .filter((rel) => TSOA_ROUTE_PATTERN.test(rel))
    .filter((rel) => !/\.d\.ts$/i.test(rel))
    .filter((rel) => !/\btests?\//i.test(rel) && !/__tests__\//i.test(rel))
    .slice(0, 50);

  const configFiles = relevantFiles.filter((rel) => /tsoa\.json$/i.test(rel)).slice(0, 10);

  const scriptsUsingTsoa = Object.entries(scripts)
    .filter(([, command]) => typeof command === "string" && command.includes("tsoa"))
    .map(([name]) => name);

  if (controllerCandidates.length === 0 && configFiles.length === 0 && !hasTsoaDependency) {
    return null;
  }

  return {
    root: normalizedRoot || ".",
    frameworks,
    usesTypeScript: true,
    hasTsoaDependency,
    totalTypeScriptFiles: tsFiles.length,
    controllerCandidates,
    configFiles,
    scriptsUsingTsoa,
    recommendedCommands: hasTsoaDependency
      ? ["npx tsoa spec", "npx tsoa routes"]
      : ["npm install --save-dev tsoa", "npx tsoa spec", "npx tsoa routes"],
  };
}

export function makeArtifactId(projectId: string, filePath: string): string {
  const hash = createHash("sha1").update(`${projectId}:${filePath}`).digest("hex");
  return `artifact-${hash}`;
}

export function prettifyName(filePath: string): string {
  const base = path.basename(filePath);
  const withoutExt = base.replace(path.extname(base), "");
  return (
    withoutExt
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "artifact"
  );
}

export function isInfrastructureYaml(base: string): boolean {
  if (DOCKER_COMPOSE_FILES.has(base)) return true;
  return KUBERNETES_KEYWORDS.some((keyword) => base.includes(keyword));
}

export function isConfigJson(base: string): boolean {
  return base === "package.json" || base.endsWith("config.json") || base.includes("manifest");
}
