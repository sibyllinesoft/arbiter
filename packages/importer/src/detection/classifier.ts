import type { ArtifactType } from "../types";
import { ArtifactDetector } from "./artifact-detector";
import type { CategoryMatrix } from "./dependency-matrix";

export interface ClassificationInput {
  /** Normalized dependency names */
  dependencies: string[];
  /** Relative file patterns found within the directory */
  filePatterns?: string[];
  /** Scripts section from a manifest */
  scripts?: Record<string, string>;
  /** Detected language; defaults to javascript for manifests without hint */
  language?: string;
  /** True when a Dockerfile or compose build context is present */
  hasDocker?: boolean;
  /** True when the package exposes a binary (`bin` field, console entrypoint, etc.) */
  hasBinaryEntry?: boolean;
}

export interface ClassificationResult {
  type: ArtifactType;
  detectedCategory: keyof CategoryMatrix;
  confidence: number;
  tags: string[];
  reasons: string[];
}

/**
 * Central classifier that maps dependency + structure signals to artifact types.
 * It wraps the ArtifactDetector while layering in directory-level cues
 * (Dockerfiles, bin entries, file patterns).
 */
export class ArtifactClassifier {
  private detector = new ArtifactDetector();

  classify(input: ClassificationInput): ClassificationResult {
    const {
      dependencies,
      filePatterns = [],
      scripts = {},
      language = "javascript",
      hasDocker = false,
      hasBinaryEntry = false,
    } = input;

    const detection = this.detector.detect({
      language: language.toLowerCase(),
      dependencies,
      scripts,
      filePatterns,
      packageConfig: {},
    });

    let type = mapCategoryToType(detection.primaryType);
    const reasons = [...detection.explanation];
    const tags = new Set<string>([type, detection.primaryType]);

    if (hasDocker && type === "package") {
      type = "service";
      reasons.unshift("dockerfile-present");
    }

    if (hasBinaryEntry && type !== "tool") {
      type = "tool";
      reasons.unshift("binary-entrypoint");
    }

    if (hasDocker) {
      tags.add("dockerized");
    }

    return {
      type,
      detectedCategory: detection.primaryType,
      confidence: detection.confidence,
      tags: Array.from(tags),
      reasons,
    };
  }
}

export function mapCategoryToType(category: keyof CategoryMatrix): ArtifactType {
  const mapping: Record<keyof CategoryMatrix, ArtifactType> = {
    tool: "tool",
    web_service: "service",
    frontend: "frontend",
    package: "package",
    desktop_app: "binary",
    data_processing: "package",
    testing: "test",
    build_tool: "package",
    game: "frontend",
    mobile: "frontend",
  };
  return mapping[category] ?? "package";
}
