import path from "node:path";
import type { FileParser } from "./base";
import {
  buildTsoaAnalysisFromPackage,
  classifyPackageManifest,
  detectNodePackageLanguage,
} from "./helpers";

export const packageJsonParser: FileParser = {
  name: "package-json",
  priority: 8,
  matches: (filePath) => path.basename(filePath).toLowerCase() === "package.json",
  parse: (content, context) => {
    const artifact = context.artifact;
    if (!artifact) return;

    try {
      const pkg = JSON.parse(content);
      const manifestDescription = typeof pkg.description === "string" ? pkg.description.trim() : "";
      const manifestVersion = typeof pkg.version === "string" ? pkg.version.trim() : "";
      artifact.metadata = {
        ...artifact.metadata,
        package: {
          name: pkg.name,
          version: manifestVersion || undefined,
          description: manifestDescription || undefined,
          scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
          dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
          devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
        },
      };

      if (typeof pkg.name === "string") {
        artifact.name = pkg.name;
      }
      if (manifestDescription) {
        artifact.description = manifestDescription;
      }
      if (pkg.dependencies) {
        if (pkg.dependencies.express) artifact.framework = "express";
        if (pkg.dependencies.fastify) artifact.framework = "fastify";
        if (pkg.dependencies.nestjs) artifact.framework = "nestjs";
      }

      const detectedLanguage = detectNodePackageLanguage(pkg);
      if (detectedLanguage) {
        artifact.language = detectedLanguage;
      }

      const classification = classifyPackageManifest(pkg);
      if (classification) {
        const previousType = artifact.type;
        artifact.type = classification.type;
        artifact.metadata = {
          ...artifact.metadata,
          detectedType: classification.detectedType,
          classification: {
            source: "manifest",
            reason: classification.reason,
            previousType,
          },
        };
        if (classification.type === "tool" && !artifact.framework) {
          artifact.framework = "cli";
        }
      }

      const tsoaAnalysis = buildTsoaAnalysisFromPackage(context.filePath, pkg, context.allFiles);
      if (tsoaAnalysis) {
        artifact.metadata = {
          ...artifact.metadata,
          tsoaAnalysis,
        };
      }
    } catch {
      // ignore parse errors
    }
  },
};
