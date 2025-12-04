import type { FileParser } from "./base";
import { cargoTomlParser } from "./cargo";
import { dockerfileParser } from "./docker";
import { dockerComposeParser } from "./dockerCompose";
import { kubernetesParser } from "./kubernetes";
import { packageJsonParser } from "./node";
import { prismaParser } from "./prisma";
import { terraformParser } from "./terraform";

export interface ParserTarget {
  parser: FileParser;
  path: string;
  priority: number;
}

export const registeredParsers: FileParser[] = [
  dockerfileParser,
  dockerComposeParser,
  packageJsonParser,
  cargoTomlParser,
  prismaParser,
  kubernetesParser,
  terraformParser,
];

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
