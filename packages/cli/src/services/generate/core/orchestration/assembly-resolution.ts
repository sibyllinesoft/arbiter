/**
 * @packageDocumentation
 * Assembly file resolution utilities for generate command.
 *
 * Provides functionality to:
 * - Resolve which assembly file to use
 * - Handle explicit spec selection
 * - Auto-discover available specs
 */

import path from "node:path";
import { discoverSpecs } from "@/services/generate/core/compose/assembly-helpers.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import fs from "fs-extra";

/**
 * Result of resolving which assembly file to use.
 */
export interface AssemblyResolutionResult {
  success: boolean;
  assemblyPath?: string;
  errorCode?: number;
}

/**
 * Resolve which assembly file to use based on options and available specs.
 */
export function resolveAssemblyFile(
  specName: string | undefined,
  options: GenerateOptions,
  reporter: GenerationReporter,
): AssemblyResolutionResult {
  if (specName || options.spec) {
    return resolveExplicitSpec(specName || options.spec!, reporter);
  }
  return resolveAutoDiscoveredSpec(reporter);
}

/**
 * Resolve an explicitly specified spec.
 */
export function resolveExplicitSpec(
  targetSpec: string,
  reporter: GenerationReporter,
): AssemblyResolutionResult {
  const assemblyPath = path.join(".arbiter", targetSpec, "assembly.cue");

  if (!fs.existsSync(assemblyPath)) {
    reporter.error(`❌ Spec "${targetSpec}" not found at ${assemblyPath}`);
    showAvailableSpecs(reporter);
    return { success: false, errorCode: 1 };
  }

  reporter.info(`📁 Using spec: ${targetSpec}`);
  return { success: true, assemblyPath };
}

/**
 * Resolve spec through auto-discovery.
 */
export function resolveAutoDiscoveredSpec(reporter: GenerationReporter): AssemblyResolutionResult {
  const availableSpecs = discoverSpecs();

  if (availableSpecs.length === 0) {
    return resolveDefaultAssembly(reporter);
  }

  if (availableSpecs.length === 1) {
    reporter.info(`✅ Auto-detected spec: ${availableSpecs[0].name}`);
    return { success: true, assemblyPath: availableSpecs[0].path };
  }

  reporter.error("❌ Multiple specs found. Please specify which one to use:");
  reporter.warn("\n📋 Available specs:");
  availableSpecs.forEach((spec) => reporter.info(`  • arbiter generate ${spec.name}`));
  return { success: false, errorCode: 1 };
}

/**
 * Resolve to default assembly path.
 */
export function resolveDefaultAssembly(reporter: GenerationReporter): AssemblyResolutionResult {
  const arbiterPath = path.resolve(".arbiter", "assembly.cue");

  if (fs.existsSync(arbiterPath)) {
    reporter.info("📁 Using .arbiter/assembly.cue");
    return { success: true, assemblyPath: arbiterPath };
  }

  reporter.error("❌ No assembly specifications found");
  reporter.info("Create a spec with: arbiter add service <name>");
  reporter.info("Or initialize with: arbiter init");
  return { success: false, errorCode: 1 };
}

/**
 * Show available specs to user.
 */
export function showAvailableSpecs(reporter: GenerationReporter): void {
  const availableSpecs = discoverSpecs();
  if (availableSpecs.length > 0) {
    reporter.warn("\n📋 Available specs:");
    availableSpecs.forEach((spec) => reporter.info(`  • ${spec.name}`));
    reporter.info(`\n💡 Usage: arbiter generate ${availableSpecs[0].name}`);
  } else {
    reporter.info("No specs found in .arbiter/ directory");
  }
}
