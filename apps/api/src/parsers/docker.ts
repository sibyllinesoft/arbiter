/**
 * Dockerfile parser.
 * Extracts base image and exposed ports from Dockerfile configurations.
 */
import path from "node:path";
import type { FileParser } from "./base";

/**
 * Parser for Dockerfile files.
 * Extracts metadata including base image from FROM instructions
 * and exposed ports from EXPOSE instructions.
 */
export const dockerfileParser: FileParser = {
  name: "dockerfile",
  priority: 10,
  matches: (filePath) => path.basename(filePath).toLowerCase().startsWith("dockerfile"),
  parse: (content, context) => {
    const artifact = context.artifact;
    if (!artifact) return;

    const lines = content.split(/\r?\n/);
    const metadata: Record<string, unknown> = { ...(artifact.metadata ?? {}) };

    const normalizedContent = content?.trimEnd();
    if (normalizedContent) {
      metadata.dockerfileContent = normalizedContent;
    }

    const fromLine = lines.find((line) => /^\s*FROM\s+/i.test(line));
    if (fromLine) {
      const baseImage = fromLine.replace(/^\s*FROM\s+/i, "").split("s")[0];
      metadata.baseImage = baseImage;
    }

    const exposePorts = lines
      .filter((line) => /^\s*EXPOSE\s+/i.test(line))
      .flatMap((line) => line.replace(/^\s*EXPOSE\s+/i, "").split(/\s+/))
      .filter(Boolean);

    if (exposePorts.length > 0) {
      metadata.exposedPorts = exposePorts;
    }

    artifact.metadata = metadata;
  },
};
