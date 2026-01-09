/**
 * Parser registry and file matching utilities.
 * Aggregates all file parsers and provides target collection.
 */
import type { FileParser } from "./base";
import { cargoTomlParser } from "./cargo";
import { dockerfileParser } from "./docker";
import { dockerComposeParser } from "./dockerCompose";
import { kubernetesParser } from "./kubernetes";
import { packageJsonParser } from "./node";
import { prismaParser } from "./prisma";
import { terraformParser } from "./terraform";

/** Represents a file matched to a parser with its priority */
export interface ParserTarget {
  parser: FileParser;
  path: string;
  priority: number;
}

/** All registered file parsers in priority order */
export const registeredParsers: FileParser[] = [
  dockerfileParser,
  dockerComposeParser,
  packageJsonParser,
  cargoTomlParser,
  prismaParser,
  kubernetesParser,
  terraformParser,
];

/**
 * Match files to their applicable parsers.
 * @param files - List of file paths to analyze
 * @returns Array of parser targets with matched parsers and priorities
 */
export function collectParserTargets(files: string[]): ParserTarget[] {
  const targets: ParserTarget[] = [];
  for (const file of files) {
    for (const parser of registeredParsers) {
      const priority = parser.priority ?? parser.weight ?? 0;
      if (parser.matches(file)) {
        targets.push({ parser, path: file, priority });
      }
    }
  }
  return targets;
}
