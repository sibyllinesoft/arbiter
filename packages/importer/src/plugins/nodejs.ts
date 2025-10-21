/**
 * Node.js Plugin for Brownfield Detection
 *
 * Simplified to focus on package.json parsing for name, description, type, and file path.
 */

import * as path from "path";
import * as fs from "fs-extra";
import { glob } from "glob";
import type { ComponentDoc, PropItem } from "react-docgen-typescript";

import {
  Evidence,
  type FileInfo,
  ImporterPlugin,
  InferenceContext,
  InferredArtifact,
  ParseContext,
} from "../types";

import type { DetectionContext } from "../detection/artifact-detector";
import { detectArtifactType } from "../detection/artifact-detector";
import type { CategoryMatrix } from "../detection/dependency-matrix";
import type { ArtifactType } from "../types";

const NODE_WEB_FRAMEWORKS = [
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

const NODE_FRONTEND_FRAMEWORKS = [
  "react",
  "vue",
  "angular",
  "svelte",
  "solid-js",
  "preact",
  "lit",
  "stimulus",
];

const NODE_CLI_FRAMEWORKS = [
  "commander",
  "yargs",
  "inquirer",
  "ora",
  "chalk",
  "boxen",
  "cli-table3",
];

interface FrontendComponentSummary {
  name: string;
  filePath: string;
  framework: "react" | "vue";
  description?: string;
  props?: Array<{
    name: string;
    type?: string;
    required: boolean;
    description?: string;
  }>;
}

interface FrontendRouteSummary {
  type: "react-router" | "next";
  routes: Array<{
    path: string;
    filePath?: string;
  }>;
}

interface FrontendAnalysis {
  frameworks: string[];
  components: FrontendComponentSummary[];
  routers: FrontendRouteSummary[];
}

type ReactDocgenModule = typeof import("react-docgen-typescript");

export interface PackageJsonData extends Record<string, unknown> {
  name: string;
  description?: string;
  type: string;
  filePath: string;
}

export class NodeJSPlugin implements ImporterPlugin {
  private reactDocgenModule: ReactDocgenModule | null | undefined;
  private reactParserCache = new Map<
    string,
    { parse: (filePaths: string[]) => ComponentDoc[] } | null
  >();

  name(): string {
    return "nodejs";
  }

  supports(filePath: string, fileContent?: string): boolean {
    const fileName = path.basename(filePath);
    return fileName === "package.json";
  }

  async parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]> {
    if (!fileContent || path.basename(filePath) !== "package.json") return [];

    const evidence: Evidence[] = [];
    const baseId = path.relative(context?.projectRoot || "", filePath);

    try {
      evidence.push(...(await this.parsePackageJson(filePath, fileContent, baseId)));
    } catch (error) {
      console.warn(`Node.js plugin failed to parse ${filePath}:`, error);
    }

    return evidence;
  }

  async infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]> {
    const nodeEvidence = evidence.filter((e) => e.source === "nodejs");
    if (nodeEvidence.length === 0) return [];

    const artifacts: InferredArtifact[] = [];

    try {
      // Infer from package.json evidence
      const packageEvidence = nodeEvidence.filter((e) => e.type === "config");
      for (const pkgEv of packageEvidence) {
        artifacts.push(...(await this.inferFromPackageJson(pkgEv, context)));
      }
    } catch (error) {
      console.warn("Node.js plugin inference failed:", error);
    }

    return artifacts;
  }

  private async parsePackageJson(
    filePath: string,
    content: string,
    baseId: string,
  ): Promise<Evidence[]> {
    const evidence: Evidence[] = [];

    try {
      const pkg = JSON.parse(content);

      // Compute logical file path based on package name
      const relativeDir = path.dirname(baseId);
      const actualSubdir = path.basename(relativeDir);
      const scopedPart = pkg.name.replace(/^@[^/]+\//, "");
      const logicalSubdir = scopedPart;
      const logicalRelativeDir = relativeDir.replace(
        new RegExp(`/${actualSubdir}$`),
        `/${logicalSubdir}`,
      );
      const logicalFilePath = path.join(logicalRelativeDir, "package.json");

      const packageData = {
        name: pkg.name || path.basename(path.dirname(filePath)),
        description: pkg.description || "",
        fullPackage: pkg,
        filePath: logicalFilePath,
      };

      evidence.push({
        id: baseId,
        source: "nodejs",
        type: "config",
        filePath,
        data: packageData,
        metadata: {
          timestamp: Date.now(),
          fileSize: content.length,
        },
      });
    } catch (error) {
      console.warn("Failed to parse package.json:", error);
    }

    return evidence;
  }

  private async inferFromPackageJson(
    packageEvidence: Evidence,
    context: InferenceContext,
  ): Promise<InferredArtifact[]> {
    const artifacts: InferredArtifact[] = [];
    const packageData = packageEvidence.data as any;
    const pkg = packageData.fullPackage;

    const scripts = pkg.scripts || {};
    const dependenciesMap = this.collectDependencies(pkg);
    const dependencyNames = Object.keys(dependenciesMap);
    const packageRoot = this.getPackageRelativeRoot(packageEvidence, context);
    const normalizedPackageRoot =
      packageRoot === "." ? "" : this.normalizeRelativePath(packageRoot);
    const filePatterns = Array.from(context.fileIndex.files.values())
      .filter((f) => {
        const rel = this.normalizeRelativePath(f.relativePath);
        if (!normalizedPackageRoot) {
          return !rel.startsWith("node_modules/");
        }
        return rel === normalizedPackageRoot || rel.startsWith(`${normalizedPackageRoot}/`);
      })
      .map((f) => this.normalizeRelativePath(f.relativePath));

    const detectionLanguage = this.usesTypeScript(pkg, scripts) ? "typescript" : "javascript";

    const manifestClassification = this.determineManifestClassification(
      pkg,
      dependenciesMap,
      scripts,
    );

    let artifactType: ArtifactType;
    let detectedType: string;
    let classificationSource = "manifest";
    let classificationReason = manifestClassification?.reason || "manifest-default";

    if (manifestClassification) {
      artifactType = manifestClassification.artifactType;
      detectedType = manifestClassification.detectedType;
    } else {
      classificationSource = "detector";
      const detectionContext = {
        language: detectionLanguage,
        dependencies: dependencyNames,
        scripts,
        filePatterns,
        packageConfig: pkg,
      };
      const { primaryType } = this.detectArtifactType(detectionContext);
      artifactType = this.mapCategoryToType(primaryType);
      detectedType = primaryType;
      classificationReason = "detector";
    }

    const metadata: Record<string, unknown> = {
      sourceFile: packageData.filePath,
      root: path.dirname(packageData.filePath),
      language: "javascript",
      framework: this.inferFramework(pkg),
      detectedType,
      classification: {
        source: classificationSource,
        reason: classificationReason,
      },
    };

    if (artifactType === "tool") {
      metadata.framework = metadata.framework || "cli";
    }

    console.log("[nodejs-plugin] inferred package", {
      name: packageData.name,
      type: artifactType,
      detectedType,
      source: classificationSource,
      reason: classificationReason,
    });

    const mainArtifact = {
      id: `${packageData.name}`,
      type: artifactType,
      name: packageData.name,
      description: packageData.description || `Node.js ${artifactType}: ${packageData.name}`,
      tags: ["nodejs", artifactType],
      metadata,
    };

    const tsoaAnalysis = await this.buildTsoaAnalysis(pkg, packageRoot, context, scripts);
    if (tsoaAnalysis) {
      if (!mainArtifact.tags.includes("tsoa-candidate")) {
        mainArtifact.tags.push("tsoa-candidate");
      }
      metadata.tsoaAnalysis = tsoaAnalysis;
    }

    const frontendAnalysis = await this.buildFrontendAnalysis(pkg, packageRoot, context);

    if (frontendAnalysis) {
      for (const framework of frontendAnalysis.frameworks) {
        if (!mainArtifact.tags.includes(framework)) {
          mainArtifact.tags.push(framework);
        }
      }

      metadata.frontendAnalysis = frontendAnalysis;
    }

    const mainInferredArtifact = {
      artifact: mainArtifact,
      provenance: {
        evidence: [packageEvidence.id],
        plugins: ["nodejs"],
        rules: ["advanced-package-detection"],
        timestamp: Date.now(),
        pipelineVersion: "1.0.0",
      },
      relationships: [],
    };

    artifacts.push(mainInferredArtifact);

    return artifacts;
  }

  private async buildFrontendAnalysis(
    pkg: any,
    packageRoot: string,
    context: InferenceContext,
  ): Promise<FrontendAnalysis | null> {
    const dependencies = this.collectDependencies(pkg);
    const hasReact =
      Boolean(dependencies.react || dependencies["react-dom"] || dependencies["react-native"]) ||
      Boolean(dependencies.next);
    const hasVue =
      Boolean(dependencies.vue) ||
      Boolean(dependencies["@vue/runtime-dom"]) ||
      Boolean(dependencies["@vue/runtime-core"]) ||
      Boolean(dependencies.nuxt) ||
      Boolean(dependencies["nuxt3"]);
    const hasReactRouter = Boolean(
      dependencies["react-router"] || dependencies["react-router-dom"],
    );
    const hasNext = Boolean(dependencies.next);

    if (!hasReact && !hasVue) {
      return null;
    }

    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    if (!projectRoot) {
      return null;
    }

    const normalizedPackageRoot =
      packageRoot === "." ? "" : this.normalizeRelativePath(packageRoot);
    const packageAbsoluteRoot = normalizedPackageRoot
      ? path.resolve(projectRoot, normalizedPackageRoot)
      : projectRoot;

    const relevantFiles = Array.from(context.fileIndex.files.values()).filter((fileInfo) =>
      this.isWithinPackage(packageAbsoluteRoot, fileInfo.path),
    );

    if (relevantFiles.length === 0) {
      return null;
    }

    const analysis: FrontendAnalysis = {
      frameworks: [],
      components: [],
      routers: [],
    };

    if (hasReact) {
      this.addFramework(analysis, "react");
      const tsconfigPath = await this.findNearestTsconfig(packageAbsoluteRoot);
      const reactComponents = await this.extractReactComponents(
        packageAbsoluteRoot,
        relevantFiles,
        tsconfigPath,
      );
      analysis.components.push(...reactComponents);

      if (hasReactRouter) {
        const reactRoutes = await this.detectReactRouterRoutes(packageAbsoluteRoot, relevantFiles);
        if (reactRoutes) {
          analysis.routers.push(reactRoutes);
        }
      }
    }

    if (hasNext) {
      this.addFramework(analysis, "next");
      const nextRoutes = this.detectNextRoutes(packageAbsoluteRoot, relevantFiles);
      if (nextRoutes) {
        analysis.routers.push(nextRoutes);
      }
    }

    if (hasVue) {
      this.addFramework(analysis, "vue");
      const vueComponents = await this.extractVueComponents(packageAbsoluteRoot, relevantFiles);
      analysis.components.push(...vueComponents);
    }

    if (!analysis.frameworks.length && !analysis.components.length && !analysis.routers.length) {
      return null;
    }

    analysis.components = this.deduplicateComponents(analysis.components).slice(0, 100);
    analysis.routers = analysis.routers.map((router) => ({
      ...router,
      routes: router.routes.slice(0, 50),
    }));

    return analysis;
  }

  private async extractReactComponents(
    packageAbs: string,
    fileInfos: FileInfo[],
    tsconfigPath?: string,
  ): Promise<FrontendComponentSummary[]> {
    const results: FrontendComponentSummary[] = [];
    const componentFiles = fileInfos
      .filter((file) => /\.(tsx|ts|jsx|js)$/.test(file.path))
      .filter((file) => !file.path.includes(`${path.sep}node_modules${path.sep}`));

    if (componentFiles.length === 0) {
      return results;
    }

    const tsxTargets = componentFiles
      .map((file) => file.path)
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .slice(0, 40);

    const parser = tsxTargets.length ? await this.getReactParser(tsconfigPath) : null;
    const discoveredKeys = new Set<string>();

    if (parser) {
      try {
        const docs = parser.parse(tsxTargets);
        for (const doc of docs) {
          if (!doc.displayName) continue;
          const sourcePath =
            doc.filePath && this.isWithinPackage(packageAbs, doc.filePath)
              ? doc.filePath
              : (tsxTargets.find(
                  (file) => doc.filePath && path.resolve(file) === path.resolve(doc.filePath),
                ) ?? null);
          const relativePath = sourcePath
            ? this.normalizeRelativePath(path.relative(packageAbs, sourcePath))
            : "";
          const props = doc.props
            ? Object.entries(doc.props)
                .slice(0, 25)
                .map(([propName, prop]) => {
                  const type = this.describePropType(prop);
                  return {
                    name: propName,
                    ...(type ? { type } : {}),
                    required: Boolean(prop.required),
                    description: prop.description?.trim() || undefined,
                  };
                })
                .filter((propInfo) => propInfo.name)
            : undefined;

          const key = `${doc.displayName}:${relativePath}`;
          if (!discoveredKeys.has(key)) {
            discoveredKeys.add(key);
            results.push({
              name: doc.displayName,
              filePath: relativePath,
              framework: "react",
              description: doc.description?.trim() || undefined,
              props: props && props.length > 0 ? props : undefined,
            });
          }
        }
      } catch (error) {
        console.warn("react-docgen-typescript parsing failed:", error);
      }
    }

    const fallbackTargets = componentFiles.slice(0, 40);
    for (const fileInfo of fallbackTargets) {
      const relativePath = this.normalizeRelativePath(path.relative(packageAbs, fileInfo.path));
      const componentName = this.inferComponentNameFromFile(fileInfo.path);
      const key = `${componentName}:${relativePath}`;
      if (!discoveredKeys.has(key)) {
        discoveredKeys.add(key);
        results.push({
          name: componentName,
          filePath: relativePath,
          framework: "react",
        });
      }
    }

    return results;
  }

  private async getReactParser(
    tsconfigPath?: string,
  ): Promise<{ parse: (filePaths: string[]) => ComponentDoc[] } | null> {
    const cacheKey = tsconfigPath ? path.resolve(tsconfigPath) : "__default__";
    if (this.reactParserCache.has(cacheKey)) {
      return this.reactParserCache.get(cacheKey) ?? null;
    }

    const docgenModule = await this.getReactDocgenModule();
    if (!docgenModule) {
      this.reactParserCache.set(cacheKey, null);
      return null;
    }

    try {
      const parserOptions = {
        savePropValueAsString: true,
        shouldExtractLiteralValuesFromEnum: true,
        shouldRemoveUndefinedFromOptional: true,
      };
      const parser =
        tsconfigPath && (await fs.pathExists(tsconfigPath))
          ? docgenModule.withCustomConfig(tsconfigPath, parserOptions)
          : docgenModule.withDefaultConfig(parserOptions);
      this.reactParserCache.set(cacheKey, parser);
      return parser;
    } catch (error) {
      console.warn("Failed to initialize react-docgen parser:", error);
      this.reactParserCache.set(cacheKey, null);
      return null;
    }
  }

  private async getReactDocgenModule(): Promise<ReactDocgenModule | null> {
    if (this.reactDocgenModule !== undefined) {
      return this.reactDocgenModule;
    }

    try {
      this.reactDocgenModule = await import("react-docgen-typescript");
    } catch (error) {
      console.warn("react-docgen-typescript module is not available:", error);
      this.reactDocgenModule = null;
    }

    return this.reactDocgenModule;
  }

  private async findNearestTsconfig(startDir: string): Promise<string | undefined> {
    let current = path.resolve(startDir);
    const root = path.parse(current).root;

    while (true) {
      const candidate = path.join(current, "tsconfig.json");
      if (await fs.pathExists(candidate)) {
        return candidate;
      }
      if (current === root) {
        break;
      }
      current = path.dirname(current);
    }

    return undefined;
  }

  private async extractVueComponents(
    packageAbs: string,
    fileInfos: FileInfo[],
  ): Promise<FrontendComponentSummary[]> {
    const vueFiles = fileInfos
      .filter((file) => file.path.endsWith(".vue"))
      .filter((file) => !file.path.includes(`${path.sep}node_modules${path.sep}`))
      .slice(0, 40);

    const results: FrontendComponentSummary[] = [];

    for (const fileInfo of vueFiles) {
      try {
        const content = await fs.readFile(fileInfo.path, "utf-8");
        const nameMatch = content.match(/\bname\s*:\s*['"]([^'"\n]+)['"]/);
        const defineMatch = content.match(
          /defineComponent\s*\(\s*{[^}]*name\s*:\s*['"]([^'"\n]+)['"]/,
        );
        const scriptSetupMatch = content.match(
          /<script[^>]*setup[^>]*>[^<]*const\s+([A-Z][A-Za-z0-9_]*)\s*=/,
        );
        const fallbackName = this.inferComponentNameFromFile(fileInfo.path);
        const componentName =
          nameMatch?.[1] ?? defineMatch?.[1] ?? scriptSetupMatch?.[1] ?? fallbackName;
        const relativePath = this.normalizeRelativePath(path.relative(packageAbs, fileInfo.path));
        results.push({
          name: componentName,
          filePath: relativePath,
          framework: "vue",
        });
      } catch {
        continue;
      }
    }

    return results;
  }

  private async detectReactRouterRoutes(
    packageAbs: string,
    fileInfos: FileInfo[],
  ): Promise<FrontendRouteSummary | null> {
    const candidates = fileInfos
      .filter((file) => /\.(tsx|ts|jsx|js)$/.test(file.path))
      .filter((file) => !file.path.includes(`${path.sep}node_modules${path.sep}`))
      .slice(0, 40);

    const routes = new Map<string, string | undefined>();

    for (const file of candidates) {
      try {
        const content = await fs.readFile(file.path, "utf-8");
        if (!/react-router/.test(content)) {
          continue;
        }
        const truncated = content.slice(0, 8000);
        const elementMatches = truncated.matchAll(/<Route[^>]*path\s*=\s*['"`]([^'"`{}]+)['"`]/g);
        for (const match of elementMatches) {
          const routePath = match[1].trim();
          if (routePath) {
            routes.set(routePath, this.normalizeRelativePath(path.relative(packageAbs, file.path)));
          }
        }

        if (/createBrowserRouter|createRoutesFromElements|createHashRouter/.test(truncated)) {
          const objectMatches = truncated.matchAll(/\bpath\s*:\s*['"`]([^'"`{}]+)['"`]/g);
          for (const match of objectMatches) {
            const routePath = match[1].trim();
            if (routePath) {
              routes.set(
                routePath,
                this.normalizeRelativePath(path.relative(packageAbs, file.path)),
              );
            }
          }
        }
      } catch {
        continue;
      }
    }

    if (!routes.size) {
      return null;
    }

    return {
      type: "react-router",
      routes: Array.from(routes.entries()).map(([pathName, filePath]) => ({
        path: pathName,
        filePath,
      })),
    };
  }

  private detectNextRoutes(packageAbs: string, fileInfos: FileInfo[]): FrontendRouteSummary | null {
    const routes = new Map<string, string | undefined>();
    const normalizedPackage = path.resolve(packageAbs);

    for (const file of fileInfos) {
      if (file.path.includes(`${path.sep}node_modules${path.sep}`)) {
        continue;
      }
      if (
        !file.path.endsWith(".tsx") &&
        !file.path.endsWith(".jsx") &&
        !file.path.endsWith(".ts") &&
        !file.path.endsWith(".js")
      ) {
        continue;
      }
      if (file.path.endsWith(".d.ts")) {
        continue;
      }

      const relativePath = this.normalizeRelativePath(path.relative(normalizedPackage, file.path));
      if (!relativePath) {
        continue;
      }

      if (relativePath.startsWith("pages/")) {
        if (relativePath.startsWith("pages/api/")) {
          continue;
        }
        let route = relativePath.slice("pages/".length).replace(/\.(tsx|jsx|ts|js)$/i, "");
        const base = path.basename(route);
        if (["_app", "_document", "_error"].includes(base)) {
          continue;
        }
        route = route.split("\\").join("/");
        if (route === "index") {
          routes.set("/", this.normalizeRelativePath(relativePath));
        } else {
          route = route.split("\\").join("/");
          if (route.endsWith("/index")) {
            route = route.slice(0, -"/index".length);
          }
          const normalizedRoute = this.normalizeNextRoute(route);
          routes.set(normalizedRoute, this.normalizeRelativePath(relativePath));
        }
        continue;
      }

      if (relativePath.startsWith("app/")) {
        const withoutExt = relativePath.replace(/\.(tsx|jsx|ts|js)$/i, "");
        if (!withoutExt.endsWith("/page")) {
          continue;
        }
        const routeSegment = withoutExt.slice("app/".length, -"/page".length);
        const normalizedRoute = this.normalizeNextRoute(routeSegment || "/");
        routes.set(normalizedRoute, this.normalizeRelativePath(relativePath));
      }
    }

    if (!routes.size) {
      return null;
    }

    return {
      type: "next",
      routes: Array.from(routes.entries()).map(([pathName, filePath]) => ({
        path: pathName,
        filePath,
      })),
    };
  }

  private normalizeNextRoute(route: string): string {
    const cleaned = route
      .split("\\")
      .join("/")
      .replace(/\/+/g, "/")
      .replace(/^\//, "")
      .replace(/\/$/, "");
    if (!cleaned) {
      return "/";
    }

    const segments = cleaned.split("/").filter(Boolean);
    const transformed = segments
      .map((segment) => this.transformNextSegment(segment))
      .filter(Boolean);
    const joined = transformed.join("/");
    const prefixed = `/${joined}`.replace(/\/+/g, "/");
    return prefixed === "/" ? "/" : prefixed.replace(/\/$/, "");
  }

  private transformNextSegment(segment: string): string {
    if (!segment) {
      return "";
    }
    if (segment.startsWith("[[...") && segment.endsWith("]]")) {
      const inner = segment.slice(4, -2);
      return `:${inner}*?`;
    }
    if (segment.startsWith("[...") && segment.endsWith("]")) {
      const inner = segment.slice(4, -1);
      return `:${inner}*`;
    }
    if (segment.startsWith("[") && segment.endsWith("]")) {
      const inner = segment.slice(1, -1);
      return `:${inner}`;
    }
    if (segment === "index") {
      return "";
    }
    return segment;
  }

  private deduplicateComponents(
    components: FrontendComponentSummary[],
  ): FrontendComponentSummary[] {
    const seen = new Map<string, FrontendComponentSummary>();
    for (const component of components) {
      if (!component.name) {
        continue;
      }
      const key = `${component.framework}:${component.name}:${component.filePath}`;
      if (!seen.has(key)) {
        seen.set(key, component);
      }
    }
    return Array.from(seen.values());
  }

  private addFramework(analysis: FrontendAnalysis, framework: string): void {
    if (!analysis.frameworks.includes(framework)) {
      analysis.frameworks.push(framework);
    }
  }

  private isWithinPackage(packageAbs: string, target: string): boolean {
    const base = path.resolve(packageAbs);
    const candidate = path.resolve(target);
    if (base === candidate) {
      return true;
    }
    const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
    return candidate.startsWith(prefix);
  }

  private describePropType(prop: PropItem): string | undefined {
    const propAny = prop as any;
    const typeSource: any = propAny.tsType ?? prop.type;
    if (!typeSource) {
      return undefined;
    }
    if (typeof typeSource.raw === "string" && typeSource.raw.trim().length > 0) {
      return typeSource.raw.trim();
    }
    if (typeSource.name === "union" && Array.isArray(typeSource.value)) {
      const unionValues = typeSource.value
        .map((item: any) => item.name || item.value)
        .filter(Boolean);
      if (unionValues.length) {
        return unionValues.join(" | ");
      }
    }
    if (typeSource.name === "enum" && Array.isArray(typeSource.value)) {
      const enumValues = typeSource.value.map((item: any) => item.value).filter(Boolean);
      if (enumValues.length) {
        return enumValues.join(" | ");
      }
    }
    if (typeof typeSource.name === "string" && typeSource.name.length > 0) {
      return typeSource.name;
    }
    return undefined;
  }

  private inferComponentNameFromFile(filePath: string): string {
    return this.toPascalCase(path.basename(filePath, path.extname(filePath))) || "Component";
  }

  private toPascalCase(value: string): string {
    return value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private getPackageRelativeRoot(evidence: Evidence, context: InferenceContext): string {
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    const packageDir = path.dirname(evidence.filePath);
    const relative = projectRoot ? path.relative(projectRoot, packageDir) : packageDir;
    const normalized = this.normalizeRelativePath(relative);
    return normalized === "" ? "." : normalized;
  }

  private normalizeRelativePath(value: string): string {
    const normalized = value.replace(/\\+/g, "/");
    if (normalized === ".") {
      return ".";
    }
    if (normalized.startsWith("./")) {
      return normalized.slice(2);
    }
    return normalized;
  }

  private collectDependencies(pkg: any): Record<string, string> {
    return {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
      ...(pkg.optionalDependencies || {}),
      ...(pkg.peerDependencies || {}),
    };
  }

  private detectFrameworkDependencies(pkg: any): string[] {
    const deps = this.collectDependencies(pkg);
    return NODE_WEB_FRAMEWORKS.filter((dep) => deps[dep]);
  }

  private determineManifestClassification(
    pkg: any,
    dependencies: Record<string, string>,
    scripts: Record<string, string>,
  ): {
    artifactType: ArtifactType;
    detectedType: string;
    reason: string;
  } | null {
    const depsLower = new Set(Object.keys(dependencies).map((dep) => dep.toLowerCase()));
    const hasAnyDependency = (candidates: string[]) =>
      candidates.some((candidate) => depsLower.has(candidate));

    const hasWebFramework = hasAnyDependency(NODE_WEB_FRAMEWORKS);
    if (hasWebFramework) {
      return {
        artifactType: "service",
        detectedType: "web_service",
        reason: "web-framework",
      };
    }

    const hasFrontendFramework =
      hasAnyDependency(NODE_FRONTEND_FRAMEWORKS) || Boolean(pkg.browserslist);
    if (hasFrontendFramework) {
      return {
        artifactType: "frontend",
        detectedType: "frontend",
        reason: "frontend-framework",
      };
    }

    const hasBin = Boolean(
      typeof pkg.bin === "string" || (pkg.bin && Object.keys(pkg.bin).length > 0),
    );
    const hasCliDependency = hasAnyDependency(NODE_CLI_FRAMEWORKS);
    if (hasBin || hasCliDependency) {
      return {
        artifactType: "tool",
        detectedType: "tool",
        reason: hasBin ? "manifest-bin" : "cli-dependency",
      };
    }

    return {
      artifactType: "module",
      detectedType: "module",
      reason: "default-module",
    };
  }

  private usesTypeScript(pkg: any, scripts: Record<string, string>): boolean {
    const deps = this.collectDependencies(pkg);
    const signals = ["typescript", "ts-node", "ts-node-dev", "tsx", "tsup", "@swc/core"];
    const hasDependency = signals.some((signal) => Boolean(deps[signal]));
    if (hasDependency) {
      return true;
    }

    if (typeof pkg.types === "string" || typeof pkg.typings === "string") {
      return true;
    }

    const scriptSignals = ["ts-node", "tsx", "ts-node-dev", "tsup", "tsc"];
    return Object.values(scripts)
      .filter((command): command is string => typeof command === "string")
      .some((command) => scriptSignals.some((signal) => command.includes(signal)));
  }

  private async buildTsoaAnalysis(
    pkg: any,
    packageRoot: string,
    context: InferenceContext,
    scripts: Record<string, string>,
  ): Promise<Record<string, unknown> | null> {
    const frameworks = this.detectFrameworkDependencies(pkg);
    if (frameworks.length === 0) {
      return null;
    }

    if (!this.usesTypeScript(pkg, scripts)) {
      return null;
    }

    const deps = this.collectDependencies(pkg);
    const hasTsoaDependency = Boolean(deps.tsoa);
    const projectRoot = context.projectRoot ?? context.fileIndex.root ?? "";
    if (!projectRoot) {
      return null;
    }

    const normalizedRoot = packageRoot === "." ? "" : this.normalizeRelativePath(packageRoot);
    const packageAbsoluteRoot = normalizedRoot
      ? path.resolve(projectRoot, normalizedRoot)
      : projectRoot;

    let tsFiles: string[] = [];
    let configFiles: string[] = [];

    try {
      tsFiles = (
        await glob("**/*.{ts,tsx}", {
          cwd: packageAbsoluteRoot,
          ignore: [
            "**/node_modules/**",
            "**/.next/**",
            "**/dist/**",
            "**/build/**",
            "**/.turbo/**",
          ],
          absolute: false,
          nodir: true,
        })
      ).map((rel) => this.normalizeRelativePath(rel));

      configFiles = (
        await glob("**/tsoa*.json", {
          cwd: packageAbsoluteRoot,
          ignore: [
            "**/node_modules/**",
            "**/.next/**",
            "**/dist/**",
            "**/build/**",
            "**/.turbo/**",
          ],
          absolute: false,
          nodir: true,
        })
      ).map((rel) => this.normalizeRelativePath(rel));
    } catch {
      return null;
    }

    const controllerCandidates = tsFiles
      .filter((rel) => /controller|route|api/i.test(rel))
      .filter((rel) => !/\.d\.ts$/i.test(rel))
      .filter((rel) => !/\btests?\//i.test(rel) && !/__tests__\//i.test(rel))
      .slice(0, 50);
    const scriptsUsingTsoa = Object.entries(scripts)
      .filter(([, command]) => typeof command === "string" && command.includes("tsoa"))
      .map(([name]) => name);

    return {
      root: packageRoot,
      frameworks,
      usesTypeScript: true,
      hasTsoaDependency,
      totalTypeScriptFiles: tsFiles.length,
      controllerCandidates,
      configFiles: configFiles.slice(0, 10),
      scriptsUsingTsoa,
      recommendedCommands: hasTsoaDependency
        ? ["npx tsoa spec", "npx tsoa routes"]
        : ["npm install --save-dev tsoa", "npx tsoa spec", "npx tsoa routes"],
    };
  }

  private detectArtifactType(context: DetectionContext): {
    primaryType: keyof CategoryMatrix;
    confidence: number;
  } {
    const result = detectArtifactType(context);
    return { primaryType: result.primaryType, confidence: result.confidence };
  }

  private mapCategoryToType(category: keyof CategoryMatrix): ArtifactType {
    const mapping: Record<keyof CategoryMatrix, ArtifactType> = {
      tool: "tool",
      web_service: "service",
      frontend: "frontend",
      module: "module",
      desktop_app: "binary", // or 'module' depending on context
      data_processing: "module",
      testing: "test",
      build_tool: "module",
      game: "frontend",
      mobile: "frontend",
    };
    return mapping[category] || "module";
  }

  private inferFramework(pkg: any): string {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (NODE_WEB_FRAMEWORKS.some((fw) => deps[fw])) return "web";
    if (NODE_FRONTEND_FRAMEWORKS.some((fw) => deps[fw])) return "frontend";
    if (NODE_CLI_FRAMEWORKS.some((fw) => deps[fw])) return "tool";
    return "";
  }
}

export const nodejsPlugin = new NodeJSPlugin();
