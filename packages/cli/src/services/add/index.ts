/**
 * @packageDocumentation
 * Add command - Compositional interface for building specifications.
 *
 * Uses AST-based CUE manipulation for incremental spec building.
 *
 * Provides functionality to:
 * - Add services, clients, endpoints, routes to specifications
 * - Add flows, locators, schemas, contracts
 * - Add packages, components, and modules
 * - Validate and persist specification changes
 */

import * as path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { safeFileOperation } from "@/constraints/index.js";
import { formatCUE, validateCUE } from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import { ProjectEntityRepository } from "@/repositories/project-entity-repository.js";
import { SpecificationRepository } from "@/repositories/specification-repository.js";
import { syncEntityWithProject } from "@/services/add/entity-sync.js";
import { toTitleCase } from "@/services/add/shared.js";
import {
  addContractOperation,
  addContractWorkflow,
} from "@/services/add/subcommands/definitions/contracts.js";
import { addRoute } from "@/services/add/subcommands/definitions/route.js";
import { addSchema } from "@/services/add/subcommands/definitions/schema.js";
import { addClient } from "@/services/add/subcommands/runtime/client.js";
import { addEndpoint } from "@/services/add/subcommands/runtime/endpoint.js";
import { addFlow } from "@/services/add/subcommands/runtime/flow.js";
import { addLocator } from "@/services/add/subcommands/runtime/locator.js";
import { addService } from "@/services/add/subcommands/runtime/service.js";
import type { CLIConfig } from "@/types.js";
import {
  type CommentKind,
  Storage,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from "@/utils/storage/index.js";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";
import {
  type MarkdownAssertionOptions,
  type MarkdownClientOptions,
  type MarkdownEndpointOptions,
  type MarkdownGroupOptions,
  type MarkdownResourceOptions,
  type MarkdownServiceOptions,
  addAssertionMarkdown,
  addClientMarkdown,
  addEndpointMarkdown,
  addGroupMarkdown,
  addResourceMarkdown,
  addServiceMarkdown,
  isMarkdownStorage,
} from "./markdown-handlers.js";

export interface AddOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  template?: string;
}

// Subcommand handler registry for routing
type SubcommandHandler = (
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & Record<string, any>,
) => Promise<string>;

const SUBCOMMAND_HANDLERS: Record<string, SubcommandHandler> = {
  service: addService,
  client: addClient,
  endpoint: addEndpoint,
  route: addRoute,
  behavior: addFlow,
  locator: addLocator,
  schema: addSchema,
  contract: addContractWorkflow,
  package: addPackage,
  component: addComponent,
  module: addModule,
};

interface AssemblyContext {
  assemblyDir: string;
  assemblyPath: string;
  content: string;
}

async function loadLocalAssembly(assemblyPath: string, verbose: boolean): Promise<string> {
  if (await fs.pathExists(assemblyPath)) {
    if (verbose) {
      console.log(chalk.dim("📁 Loaded existing specification from .arbiter directory"));
    }
    return fs.readFile(assemblyPath, "utf-8");
  }
  console.log(chalk.yellow("⚠️  No existing specification found. Creating new specification..."));
  return initializeAssembly();
}

async function loadRemoteAssembly(
  config: CLIConfig,
  assemblyPath: string,
  verbose: boolean,
): Promise<string> {
  const apiClient = new ApiClient(config);
  const specRepo = new SpecificationRepository(apiClient);

  try {
    const storedSpec = await specRepo.getSpecification("assembly", assemblyPath);
    if (storedSpec.success && storedSpec.data?.content) {
      if (verbose) {
        console.log(
          chalk.dim("📡 Retrieved existing specification from service (sharded storage)"),
        );
      }
      return storedSpec.data.content;
    }
    throw new Error("No stored specification found");
  } catch {
    return loadLocalAssembly(assemblyPath, verbose);
  }
}

async function getAssemblyContext(
  config: CLIConfig,
  options: AddOptions,
): Promise<AssemblyContext> {
  const assemblyDir = path.resolve(".arbiter");
  const assemblyPath = path.join(assemblyDir, "assembly.cue");
  const useLocalOnly = config.localMode === true;

  if (useLocalOnly && options.verbose) {
    console.log(chalk.dim("📁 Local mode enabled: using .arbiter CUE files only"));
  }

  const content = useLocalOnly
    ? await loadLocalAssembly(assemblyPath, options.verbose ?? false)
    : await loadRemoteAssembly(config, assemblyPath, options.verbose ?? false);

  return { assemblyDir, assemblyPath, content };
}

async function routeSubcommand(
  manipulator: any,
  subcommand: string,
  assemblyContent: string,
  name: string,
  options: AddOptions & Record<string, any>,
): Promise<string | null> {
  // Special case for contract-operation
  if (subcommand === "contract-operation") {
    const contractName = options.contract;
    if (typeof contractName !== "string" || contractName.trim().length === 0) {
      throw new Error("Contract name is required for contract-operation subcommand");
    }
    return addContractOperation(manipulator, assemblyContent, contractName, name, options);
  }

  const handler = SUBCOMMAND_HANDLERS[subcommand];
  if (!handler) {
    console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
    console.log(
      chalk.dim(
        "Available subcommands: service, client, endpoint, route, flow, locator, schema, contract, contract-operation, package, component, module",
      ),
    );
    console.log(
      chalk.dim(
        "Infrastructure aliases: database, cache, queue, load-balancer (these create services with --type)",
      ),
    );
    return null;
  }

  return handler(manipulator, assemblyContent, name, options);
}

async function persistLocalAssembly(
  ctx: AssemblyContext,
  content: string,
  reason: string,
  options: AddOptions,
): Promise<void> {
  await fs.ensureDir(ctx.assemblyDir);
  await safeFileOperation("write", ctx.assemblyPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, "utf-8");
  });

  const relativePath = path.relative(process.cwd(), ctx.assemblyPath) || ctx.assemblyPath;
  const suffix = reason ? ` (${reason})` : "";
  console.log(chalk.green(`✅ Updated ${relativePath}${suffix}`));

  if (options.verbose) {
    console.log(chalk.dim("Added configuration:"));
    console.log(chalk.dim(showDiff(ctx.content, content)));
  }
}

function logStoreSuccess(subcommand: string, name: string, shardName?: string): void {
  console.log(chalk.green(`✅ Updated specification in service (${subcommand}: ${name})`));
  console.log(
    chalk.dim("💡 CUE files will be generated to .arbiter/ when specification is complete"),
  );
  if (shardName) {
    console.log(chalk.dim(`   Stored in shard: ${shardName}`));
  }
}

function logVerboseDiff(ctx: AssemblyContext, updatedContent: string, verbose?: boolean): void {
  if (!verbose) return;
  console.log(chalk.dim("Added configuration:"));
  console.log(chalk.dim(showDiff(ctx.content, updatedContent)));
}

function logStorageError(error: unknown): void {
  console.error(
    chalk.red("❌ Failed to store specification with Arbiter service:"),
    error instanceof Error ? error.message : String(error),
  );
  console.error(chalk.dim("Tip: re-run with --local if you intentionally want to work offline."));
}

async function storeRemoteSpecification(
  config: CLIConfig,
  ctx: AssemblyContext,
  updatedContent: string,
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
): Promise<boolean> {
  const apiClient = new ApiClient(config);
  const specRepo = new SpecificationRepository(apiClient);

  try {
    const shardType = getShardTypeForSubcommand(subcommand);
    const storeResult = await specRepo.storeSpecification({
      content: updatedContent,
      type: shardType,
      path: ctx.assemblyPath,
      shard: shardType,
    });

    if (!storeResult.success) {
      throw new Error(storeResult.error || "Failed to store specification");
    }

    logStoreSuccess(subcommand, name, storeResult.data?.shard);
    logVerboseDiff(ctx, updatedContent, options.verbose);
    await syncEntityWithProject(apiClient, config, subcommand, name, options);
    return true;
  } catch (apiError) {
    logStorageError(apiError);
    return false;
  }
}

/**
 * Validate CUE content and report errors
 */
async function validateContent(content: string): Promise<boolean> {
  const validationResult = await validateCUE(content);
  if (validationResult.valid) {
    return true;
  }

  console.error(chalk.red("❌ CUE validation failed:"));
  validationResult.errors.forEach((error) => console.error(chalk.red(`  • ${error}`)));
  return false;
}

/**
 * Persist specification changes based on mode (dry-run, local, remote)
 */
async function persistSpecification(
  ctx: AssemblyContext,
  updatedContent: string,
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
  config: CLIConfig,
): Promise<boolean> {
  if (options.dryRun) {
    console.log(chalk.yellow("🔍 Dry run - changes that would be made:"));
    console.log(chalk.dim(showDiff(ctx.content, updatedContent)));
    return true;
  }

  if (config.localMode) {
    await persistLocalAssembly(ctx, updatedContent, "local mode", options);
    return true;
  }

  return storeRemoteSpecification(config, ctx, updatedContent, subcommand, name, options);
}

/**
 * Main add command dispatcher
 */
export async function runAddCommand(
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
  config: CLIConfig,
): Promise<number> {
  const projectDir = config.projectDir ?? process.cwd();

  // Handle task and note separately (they use dedicated storage files)
  if (subcommand === "task") {
    return addTask(name, options, config);
  }
  if (subcommand === "note") {
    return addNote(name, options, config);
  }

  // Check if project uses markdown-first storage
  const useMarkdown = await isMarkdownStorage(projectDir);

  if (useMarkdown) {
    return runMarkdownAddCommand(subcommand, name, options, projectDir);
  }

  // Fall back to CUE-based add for legacy projects
  const manipulator = getCueManipulator();

  try {
    console.log(chalk.blue(`🔧 Adding ${subcommand}: ${name}`));

    const ctx = await getAssemblyContext(config, options);
    const updatedContent = await routeSubcommand(
      manipulator,
      subcommand,
      ctx.content,
      name,
      options,
    );

    if (updatedContent === null) {
      return 1;
    }

    if (!(await validateContent(updatedContent))) {
      return 1;
    }

    const success = await persistSpecification(
      ctx,
      updatedContent,
      subcommand,
      name,
      options,
      config,
    );
    return success ? 0 : 1;
  } catch (error) {
    console.error(chalk.red("❌ Failed to add component:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  } finally {
    await manipulator.cleanup();
  }
}

/**
 * Route add commands through markdown handlers for markdown-first projects.
 */
async function runMarkdownAddCommand(
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
  projectDir: string,
): Promise<number> {
  console.log(chalk.blue(`🔧 Adding ${subcommand}: ${name}`));

  switch (subcommand) {
    case "service":
      return addServiceMarkdown(name, options as MarkdownServiceOptions, projectDir);

    case "endpoint":
      return addEndpointMarkdown(name, options as MarkdownEndpointOptions, projectDir);

    case "resource":
      // Resource requires kind option
      if (!options.kind) {
        console.error(chalk.red("❌ --kind is required for resources"));
        console.log(
          chalk.dim("Usage: arbiter add resource <name> --kind <database|cache|queue|storage>"),
        );
        return 1;
      }
      return addResourceMarkdown(name, options as MarkdownResourceOptions, projectDir);

    case "client":
      return addClientMarkdown(name, options as MarkdownClientOptions, projectDir);

    case "group":
      return addGroupMarkdown(name, options as MarkdownGroupOptions, projectDir);

    case "database":
      // Alias: arbiter add database <name> -> arbiter add resource <name> --kind database
      return addResourceMarkdown(
        name,
        { ...options, kind: "database" } as MarkdownResourceOptions,
        projectDir,
      );

    case "cache":
      return addResourceMarkdown(
        name,
        { ...options, kind: "cache" } as MarkdownResourceOptions,
        projectDir,
      );

    case "queue":
      return addResourceMarkdown(
        name,
        { ...options, kind: "queue" } as MarkdownResourceOptions,
        projectDir,
      );

    case "assertion":
      return addAssertionMarkdown(name, options as MarkdownAssertionOptions, projectDir);

    default:
      console.error(
        chalk.red(`❌ Subcommand "${subcommand}" is not yet supported with markdown storage.`),
      );
      console.log(
        chalk.dim(
          "Supported: service, endpoint, resource, client, group, database, cache, queue, assertion",
        ),
      );
      console.log(
        chalk.dim("For other commands, use a CUE-based project (arbiter init with --legacy flag)."),
      );
      return 1;
  }
}

/**
 * Add a task to the dedicated tasks markdown storage
 */
async function addTask(
  title: string,
  options: AddOptions & {
    type?: string;
    status?: string;
    priority?: string;
    assignee?: string;
    labels?: string;
    refs?: string;
    milestone?: string;
    description?: string;
  },
  config: CLIConfig,
): Promise<number> {
  try {
    const projectDir = config.projectDir ?? process.cwd();
    const storage = new Storage({
      baseDir: path.join(projectDir, ".arbiter"),
      notesDir: path.join(projectDir, ".arbiter", "notes"),
      tasksDir: path.join(projectDir, ".arbiter", "tasks"),
    });
    await storage.initialize();

    // Parse entity references (format: type:slug,type:slug)
    const references = options.refs
      ? options.refs.split(",").map((ref) => {
          const [type, slug] = ref.trim().split(":");
          return { type: type || "package", slug: slug || type };
        })
      : undefined;

    const task = await storage.saveIssue({
      title,
      type: (options.type as TaskType) || "task",
      status: (options.status as TaskStatus) || "open",
      priority: options.priority as TaskPriority,
      assignees: options.assignee ? [options.assignee] : undefined,
      labels: options.labels ? options.labels.split(",").map((l) => l.trim()) : undefined,
      references,
      milestone: options.milestone,
      description: options.description,
    });

    console.log(chalk.green(`✅ Created task: ${task.id}`));
    console.log(chalk.dim(`   Title: ${task.title}`));
    console.log(chalk.dim(`   Status: ${task.status}`));
    if (task.priority) console.log(chalk.dim(`   Priority: ${task.priority}`));
    if (task.references?.length) {
      console.log(
        chalk.dim(`   References: ${task.references.map((r) => `${r.type}:${r.slug}`).join(", ")}`),
      );
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("❌ Failed to add task:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Add a note/comment to the dedicated notes markdown storage
 */
async function addNote(
  content: string,
  options: AddOptions & {
    target?: string;
    kind?: string;
    author?: string;
    tags?: string;
  },
  config: CLIConfig,
): Promise<number> {
  try {
    if (!options.target) {
      console.error(chalk.red("❌ --target is required for notes"));
      console.log(chalk.dim('Usage: arbiter add note "content" --target <entity-slug>'));
      return 1;
    }

    const projectDir = config.projectDir ?? process.cwd();
    const storage = new Storage({
      baseDir: path.join(projectDir, ".arbiter"),
      notesDir: path.join(projectDir, ".arbiter", "notes"),
      tasksDir: path.join(projectDir, ".arbiter", "tasks"),
    });
    await storage.initialize();

    const note = await storage.addComment(options.target, content, {
      kind: (options.kind as CommentKind) || "note",
      author: options.author,
      tags: options.tags ? options.tags.split(",").map((t) => t.trim()) : undefined,
    });

    console.log(chalk.green(`✅ Created note: ${note.id}`));
    console.log(chalk.dim(`   Target: ${note.target}`));
    console.log(chalk.dim(`   Kind: ${note.kind || "note"}`));
    if (note.author) console.log(chalk.dim(`   Author: ${note.author}`));

    return 0;
  } catch (error) {
    console.error(chalk.red("❌ Failed to add note:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Initialize a new assembly file with basic structure
 */
async function initializeAssembly(): Promise<string> {
  const projectName = path.basename(process.cwd());

  const content = `package ${projectName.replace(/[^a-zA-Z0-9]/g, "")}

// Auto-generated arbiter.assembly.cue
// Build your specification incrementally with: arbiter add <component>

product: {
  name: "${toTitleCase(projectName)}"
  goals: ["Application goals will be defined here"]
}

ui: {
  routes: [
    {
      id:   "app:home"
      path: "/"
      capabilities: ["view"]
      components: ["HomePage"]
    },
    ...
  ]
}

locators: {
  "page:home":  "[data-testid=\\"home-page\\"]"
  "btn:start":  "[data-testid=\\"start-button\\"]"
  "toast:ok":   "[data-testid=\\"toast-ok\\"]"
}

behaviors: [
  {
    id: "baseline_e2e"
    steps: [
      { visit: "/" },
      { expect: { locator: "page:home",  state: "visible" } },
      { click:  "btn:start" },
      { expect: { locator: "toast:ok", text: { contains: "ready" } } },
    ]
  },
  ...
]

// V1 compatibility structure
config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "${projectName}"
  version: "1.0.0"
}

deployment: {
  target: "kubernetes"
}

services: {}`;

  // Format using CUE tool
  return await formatCUE(content);
}

/**
 * Flow configuration options
 */
/**
 * Add a reusable package/library
 */
async function addPackage(
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & {
    language?: string;
    directory?: string;
    exports?: string;
    version?: string;
  },
): Promise<string> {
  const packageName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const packageConfig: any = {
    name: packageName,
    type: "package",
    language: options.language || "typescript",
    version: options.version || "0.1.0",
    directory: options.directory || `packages/${packageName}`,
  };

  if (options.exports) {
    packageConfig.exports = options.exports.split(",").map((e) => e.trim());
  }

  return await manipulator.addToSection(content, "components.packages", packageName, packageConfig);
}

/**
 * Add a UI component
 */
async function addComponent(
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & {
    framework?: string;
    directory?: string;
    props?: string;
    stories?: boolean;
  },
): Promise<string> {
  const componentName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const componentConfig: any = {
    name: componentName,
    type: "component",
    framework: options.framework || "react",
    directory: options.directory || `src/components/${componentName}`,
  };

  if (options.props) {
    componentConfig.props = options.props.split(",").map((p) => p.trim());
  }

  if (options.stories) {
    componentConfig.storybook = true;
  }

  return await manipulator.addToSection(content, "components.ui", componentName, componentConfig);
}

/**
 * Add a standalone module
 */
async function addModule(
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & {
    language?: string;
    directory?: string;
    functions?: string;
    types?: string;
  },
): Promise<string> {
  const moduleName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const moduleConfig: any = {
    name: moduleName,
    type: "package",
    language: options.language || "typescript",
    directory: options.directory || `src/modules/${moduleName}`,
  };

  if (options.functions) {
    moduleConfig.functions = options.functions.split(",").map((f) => f.trim());
  }

  if (options.types) {
    moduleConfig.types = options.types.split(",").map((t) => t.trim());
  }

  return await manipulator.addToSection(content, "components.modules", moduleName, moduleConfig);
}

// Helper functions
function showDiff(oldContent: string, newContent: string): string {
  const diff = diffLines(oldContent, newContent);

  return diff
    .flatMap((part) =>
      part.value
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => {
          if (part.added) return `+ ${line}`;
          if (part.removed) return `- ${line}`;
          return `  ${line}`;
        }),
    )
    .join("\n");
}

/**
 * Determine shard type based on add subcommand for better organization.
 * @param subcommand - The add subcommand
 * @returns Shard type string
 */
function getShardTypeForSubcommand(subcommand: string): string {
  const shardMapping: Record<string, string> = {
    service: "services",
    client: "clients",
    endpoint: "endpoints",
    route: "routes",
    behavior: "behaviors",
    schema: "schemas",
    locator: "locators",
    contract: "contracts",
    "contract-operation": "contracts",
    package: "packages",
    component: "components",
    module: "modules",
  };

  return shardMapping[subcommand] || "assembly";
}
