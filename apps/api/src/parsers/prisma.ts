/**
 * Prisma schema parser.
 * Extracts database configuration and provider information from Prisma schema files.
 */
import path from "node:path";
import type { FileParser } from "./base";

/**
 * Parser for Prisma schema files (schema.prisma).
 * Detects the database provider and marks artifacts as database type.
 */
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
