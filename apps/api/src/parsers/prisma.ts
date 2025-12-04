import path from "node:path";
import type { FileParser } from "./base";

export const prismaParser: FileParser = {
  name: "prisma",
  priority: 6,
  matches: (filePath) => path.basename(filePath).toLowerCase().includes("schema.prisma"),
  parse: (content, context) => {
    const artifact = context.artifact;
    if (!artifact) return;

    const datasourceMatch = content.match(/datasource\s+\w+\s+\{[\s\S]*?provider\s*=\s*"([^"]+)"/);
    if (datasourceMatch) {
      artifact.metadata = {
        ...artifact.metadata,
        prismaProvider: datasourceMatch[1],
      };
      artifact.type = "database";
      artifact.description = `Database schema (provider: ${datasourceMatch[1]})`;
    }
  },
};
