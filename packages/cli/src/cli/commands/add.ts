/**
 * @packageDocumentation
 * Add commands module - Provides CLI commands for incrementally building
 * CUE specifications through modular generators.
 *
 * Supports adding:
 * - Services (including databases, caches, queues, load balancers)
 * - Client applications
 * - Contracts and contract operations
 * - API endpoints
 * - UI routes and locators
 * - Schemas, packages, components, and modules
 */

import { requireCommandConfig } from "@/cli/context.js";
import type { AddOptions } from "@/services/add/index.js";
import { runAddCommand } from "@/services/add/index.js";
import chalk from "chalk";
import { Command } from "commander";

/**
 * Supported entity types for the add command.
 */
type EntityType =
  | "service"
  | "client"
  | "contract"
  | "contract-operation"
  | "endpoint"
  | "route"
  | "behavior"
  | "locator"
  | "schema"
  | "package"
  | "component"
  | "module"
  | "task"
  | "note"
  | "assertion";

/**
 * Configuration for a CLI option.
 */
interface OptionConfig {
  /** Flag string (e.g., "--port <port>") */
  flags: string;
  /** Help text for the option */
  description: string;
  /** Default value or parser function */
  defaultValue?: string | number | ((v: string) => number);
}

/** Extended options type that allows dynamic properties from CLI flags */
type ExtendedAddOptions = AddOptions & Record<string, unknown>;

/**
 * Configuration for an add subcommand.
 */
interface AddSubcommandConfig {
  /** Command name pattern (e.g., "service <name>") */
  name: string;
  /** Help text for the subcommand */
  description: string;
  /** Entity type this command creates */
  entityType: EntityType;
  /** Available options for this subcommand */
  options: OptionConfig[];
  /** Optional transform function to modify options before execution */
  transformOptions?: (
    options: ExtendedAddOptions,
    name: string,
  ) => { name: string; options: ExtendedAddOptions };
}

/**
 * Handle command errors by logging and exiting with error code 2.
 * @param error - The error that occurred
 */
function handleCommandError(error: unknown): never {
  console.error(
    chalk.red("Command failed:"),
    error instanceof Error ? error.message : String(error),
  );
  process.exit(2);
}

/**
 * Parse a string value as an integer port number.
 * @param value - String representation of the port
 * @returns Parsed port number
 */
function parsePort(value: string): number {
  return Number.parseInt(value, 10);
}

/**
 * Create an action handler for an add subcommand.
 * @param entityType - The type of entity being added
 * @param transformOptions - Optional function to transform options before execution
 * @returns Action handler function for Commander
 */
function createActionHandler(
  entityType: EntityType,
  transformOptions?: AddSubcommandConfig["transformOptions"],
) {
  return async (
    nameOrArg1: string | ExtendedAddOptions,
    optionsOrArg2: ExtendedAddOptions | string | Command,
    maybeOptionsOrCommand?: ExtendedAddOptions | Command,
    maybeCommand?: Command,
  ) => {
    // Handle both single and double argument commands, plus no-argument commands
    let name: string;
    let options: ExtendedAddOptions;
    let command: Command;

    if (typeof nameOrArg1 === "object" && !(nameOrArg1 instanceof Command)) {
      // No positional argument: (options, command)
      // Commands like "assertion" that have no <name> argument
      name = "";
      options = nameOrArg1 as ExtendedAddOptions;
      command = optionsOrArg2 as Command;
    } else if (typeof optionsOrArg2 === "string") {
      // Double argument: contract-operation <contract> <operation>
      name = optionsOrArg2; // operation is the name
      options = maybeOptionsOrCommand as ExtendedAddOptions;
      options = { ...options, contract: nameOrArg1 as string }; // contract is first arg
      command = maybeCommand as Command;
    } else if (maybeOptionsOrCommand instanceof Command) {
      // Single argument with Command as third parameter
      name = nameOrArg1 as string;
      options = optionsOrArg2 as ExtendedAddOptions;
      command = maybeOptionsOrCommand;
    } else if (maybeCommand instanceof Command) {
      // Single argument with Command as fourth parameter
      name = nameOrArg1 as string;
      options = optionsOrArg2 as ExtendedAddOptions;
      command = maybeCommand;
    } else {
      // Fallback - should not normally reach here
      throw new Error("Unable to determine command context");
    }

    try {
      const config = requireCommandConfig(command);

      // Parse unknown arguments as metadata
      const unknownArgs = command.args.slice(1); // Skip the name argument
      const extraMetadata = parseUnknownFlags(unknownArgs);

      // Merge extra metadata into options
      if (Object.keys(extraMetadata).length > 0) {
        const existingMetadata = (options.metadata ?? {}) as Record<string, unknown>;
        options.metadata = { ...existingMetadata, ...extraMetadata };
      }

      if (transformOptions) {
        const transformed = transformOptions(options, name);
        name = transformed.name;
        options = transformed.options;
      }

      const exitCode = await runAddCommand(entityType, name, options, config);
      process.exit(exitCode);
    } catch (error) {
      handleCommandError(error);
    }
  };
}

/**
 * Add options to a Commander command.
 * @param cmd - The command to add options to
 * @param options - Array of option configurations
 * @returns The command with options added
 */
function addOptions(cmd: Command, options: OptionConfig[]): Command {
  for (const opt of options) {
    if (opt.defaultValue !== undefined) {
      // Handle different default value types for Commander overloads
      if (typeof opt.defaultValue === "function") {
        // Parser function overload
        cmd = cmd.option(
          opt.flags,
          opt.description,
          opt.defaultValue as (value: string, previous: number) => number,
        );
      } else {
        // Static default value overload
        cmd = cmd.option(opt.flags, opt.description, opt.defaultValue as string);
      }
    } else {
      cmd = cmd.option(opt.flags, opt.description);
    }
  }
  return cmd;
}

/** Common options available on all add subcommands */
const COMMON_OPTIONS: OptionConfig[] = [
  { flags: "--dry-run", description: "preview changes without applying them" },
  { flags: "--force", description: "overwrite existing configuration" },
];

/** Configuration array for all add subcommands */
const ADD_SUBCOMMANDS: AddSubcommandConfig[] = [
  {
    name: "service <name>",
    description:
      "add a service to the specification (includes databases, caches, queues, load balancers)",
    entityType: "service",
    options: [
      { flags: "--template <alias>", description: "use template alias for service generation" },
      {
        flags: "--language <lang>",
        description: "programming language (typescript, python, rust, go)",
        defaultValue: "typescript",
      },
      { flags: "--port <port>", description: "service port number", defaultValue: parsePort },
      {
        flags: "--type <type>",
        description:
          "infrastructure type (database, cache, queue, load-balancer) - creates a service with this type",
      },
      {
        flags: "--image <image>",
        description:
          "container image for external/prebuilt services (e.g., postgres:15, redis:7-alpine)",
      },
      {
        flags: "--service-type <type>",
        description:
          "platform-specific service type (cloudflare_worker, vercel_function, supabase_functions, etc.)",
      },
      {
        flags: "--attach-to <service>",
        description: "attach this infrastructure service to another service",
      },
      {
        flags: "--parent <group>",
        description: "parent group for directory organization (e.g., admin creates apps/admin/)",
      },
    ],
  },
  {
    name: "client <name>",
    description: "add a client application to the specification",
    entityType: "client",
    options: [
      { flags: "--template <alias>", description: "use template alias for client generation" },
      {
        flags: "--language <lang>",
        description: "primary language (typescript, python, etc.)",
        defaultValue: "typescript",
      },
      { flags: "--directory <dir>", description: "output directory for generated client files" },
      {
        flags: "--framework <framework>",
        description: "framework identifier (vue, react, svelte, etc.)",
      },
      { flags: "--port <port>", description: "local dev port", defaultValue: parsePort },
      { flags: "--description <text>", description: "short description of the client" },
      { flags: "--tags <tags>", description: "comma-separated tags for the client" },
      {
        flags: "--parent <group>",
        description: "parent group for directory organization (e.g., admin creates apps/admin/)",
      },
    ],
  },
  {
    name: "contract <name>",
    description: "add or update a contract workflow/event definition",
    entityType: "contract",
    options: [
      {
        flags: "--kind <kind>",
        description: "contract kind (workflows or events)",
        defaultValue: "workflows",
      },
      { flags: "--version <version>", description: "contract version tag" },
      { flags: "--summary <text>", description: "short summary to describe the contract" },
      { flags: "--description <text>", description: "long-form description" },
    ],
  },
  {
    name: "contract-operation <contract> <operation>",
    description: "add or update an operation on a contract workflow/event",
    entityType: "contract-operation",
    options: [
      {
        flags: "--kind <kind>",
        description: "contract kind (workflows or events)",
        defaultValue: "workflows",
      },
      { flags: "--summary <text>", description: "summary for the operation" },
      { flags: "--description <text>", description: "detailed operation description" },
      { flags: "--input-schema <schema>", description: "schema reference for the request payload" },
      {
        flags: "--input-key <key>",
        description: "field name for request payload",
        defaultValue: "payload",
      },
      { flags: "--input-example <json>", description: "JSON example for the request payload" },
      {
        flags: "--output-schema <schema>",
        description: "schema reference for the response payload",
      },
      {
        flags: "--output-key <key>",
        description: "field name for response payload",
        defaultValue: "result",
      },
      { flags: "--output-example <json>", description: "JSON example for the response payload" },
    ],
  },
  {
    name: "endpoint <path>",
    description: "add an API endpoint to a service",
    entityType: "endpoint",
    options: [
      {
        flags: "--method <method>",
        description: "HTTP method (GET, POST, PUT, DELETE, PATCH)",
        defaultValue: "GET",
      },
      { flags: "--service <service>", description: "target service name" },
      { flags: "--summary <summary>", description: "short description shown in docs" },
      { flags: "--description <description>", description: "long-form description for docs" },
      {
        flags: "--response-type <type>",
        description: "response content type (json, xml, text)",
        defaultValue: "json",
      },
      {
        flags: "--auth <auth>",
        description: "authentication requirement (none, bearer, basic, api-key)",
        defaultValue: "none",
      },
      {
        flags: "--implements <contract>",
        description: "contract operation reference (e.g. contracts.apis.foo.get)",
      },
      {
        flags: "--handler-module <module>",
        description: "handler module path for service endpoint metadata",
      },
      {
        flags: "--handler-fn <name>",
        description: "handler function name for service endpoint metadata",
      },
      {
        flags: "--endpoint-id <id>",
        description: "explicit endpoint identifier for service metadata",
      },
    ],
  },
  {
    name: "route <path>",
    description: "add a UI route for frontend applications",
    entityType: "route",
    options: [
      { flags: "--component <component>", description: "React component name" },
      { flags: "--id <id>", description: "route identifier (auto-generated if not specified)" },
      { flags: "--layout <layout>", description: "layout component to use" },
      {
        flags: "--auth <auth>",
        description: "authentication requirement (none, required)",
        defaultValue: "none",
      },
    ],
  },
  {
    name: "behavior <id>",
    description: "add a user behavior for testing and validation",
    entityType: "behavior",
    options: [
      { flags: "--description <description>", description: "behavior description" },
      {
        flags: "--steps <steps>",
        description: 'JSON array of behavior steps (e.g. "[{"visit":"/"}]")',
      },
      { flags: "--expected-outcome <outcome>", description: "expected outcome of the behavior" },
    ],
  },
  {
    name: "assertion",
    description: "add or update Hurl assertions for an endpoint",
    entityType: "assertion",
    options: [
      { flags: "--endpoint <path>", description: "endpoint path (e.g. /api/health)" },
      { flags: "--service <service>", description: "service containing the endpoint" },
      {
        flags: "--hurl <assertions>",
        description: "Hurl assertion block (HTTP status + [Asserts])",
      },
      { flags: "--edit", description: "open assertions in $EDITOR" },
      { flags: "--append", description: "append to existing assertions instead of replacing" },
    ],
  },
  {
    name: "database <name>",
    description: "add a database service (alias for: arbiter add service <name> --type database)",
    entityType: "service",
    options: [
      {
        flags: "--image <image>",
        description: "database container image (e.g., postgres:15, mysql:8)",
        defaultValue: "postgres:15",
      },
      { flags: "--port <port>", description: "database port", defaultValue: parsePort },
      {
        flags: "--service-type <type>",
        description:
          "platform-specific database type (cloudflare_d1, vercel_postgres, supabase_database)",
      },
      { flags: "--attach-to <service>", description: "attach this database to another service" },
    ],
    transformOptions: (options, name) => ({
      name,
      options: {
        ...options,
        type: "database",
        image: options.image || "postgres:15",
        port: options.port || 5432,
      },
    }),
  },
  {
    name: "cache <name>",
    description: "add a cache service (alias for: arbiter add service <name> --type cache)",
    entityType: "service",
    options: [
      {
        flags: "--image <image>",
        description: "cache container image (e.g., redis:7-alpine)",
        defaultValue: "redis:7-alpine",
      },
      { flags: "--port <port>", description: "cache port", defaultValue: parsePort },
      {
        flags: "--service-type <type>",
        description: "platform-specific cache type (cloudflare_kv, vercel_kv, upstash_redis)",
      },
      { flags: "--attach-to <service>", description: "attach this cache to another service" },
    ],
    transformOptions: (options, name) => ({
      name,
      options: {
        ...options,
        type: "cache",
        image: options.image || "redis:7-alpine",
        port: options.port || 6379,
      },
    }),
  },
  {
    name: "queue <name>",
    description: "add a message queue service (alias for: arbiter add service <name> --type queue)",
    entityType: "service",
    options: [
      {
        flags: "--image <image>",
        description: "queue container image (e.g., rabbitmq:3-management)",
        defaultValue: "rabbitmq:3-management",
      },
      { flags: "--port <port>", description: "queue port", defaultValue: parsePort },
      {
        flags: "--service-type <type>",
        description: "platform-specific queue type (cloudflare_queues, aws_sqs)",
      },
      { flags: "--attach-to <service>", description: "attach this queue to another service" },
    ],
    transformOptions: (options, name) => ({
      name,
      options: {
        ...options,
        type: "queue",
        image: options.image || "rabbitmq:3-management",
        port: options.port || 5672,
      },
    }),
  },
  {
    name: "load-balancer <name>",
    description:
      "add a load balancer service (alias for: arbiter add service <name> --type load-balancer)",
    entityType: "service",
    options: [
      {
        flags: "--image <image>",
        description: "load balancer container image",
        defaultValue: "nginx:alpine",
      },
      { flags: "--port <port>", description: "load balancer port", defaultValue: parsePort },
      { flags: "--target <service>", description: "target service to load balance" },
      {
        flags: "--health-check-path <path>",
        description: "health check endpoint path",
        defaultValue: "/health",
      },
    ],
    transformOptions: (options, name) => ({
      name,
      options: {
        ...options,
        type: "load-balancer",
        image: options.image || "nginx:alpine",
        port: options.port || 80,
      },
    }),
  },
  {
    name: "locator <key>",
    description: "add a UI locator for testing",
    entityType: "locator",
    options: [
      { flags: "--selector <selector>", description: "CSS selector or XPath" },
      { flags: "--description <description>", description: "locator description" },
    ],
  },
  {
    name: "schema <name>",
    description: "add a schema for API documentation",
    entityType: "schema",
    options: [
      {
        flags: "--type <type>",
        description: "schema type (request, response, model)",
        defaultValue: "model",
      },
      {
        flags: "--format <format>",
        description: "schema format (json-schema, openapi)",
        defaultValue: "json-schema",
      },
    ],
  },
  {
    name: "package <name>",
    description: "add a reusable package/library (e.g. design systems, shared utilities)",
    entityType: "package",
    options: [
      {
        flags: "--language <lang>",
        description: "programming language (typescript, python, rust, go)",
        defaultValue: "typescript",
      },
      { flags: "--directory <dir>", description: "source directory path" },
      { flags: "--exports <exports>", description: "comma-separated list of main exports" },
      {
        flags: "--version <version>",
        description: "initial version number",
        defaultValue: "1.0.0",
      },
      {
        flags: "--parent <group>",
        description: "parent group for directory organization",
      },
    ],
  },
  {
    name: "component <name>",
    description: "add a UI component (e.g. buttons, forms, layout components)",
    entityType: "component",
    options: [
      {
        flags: "--type <type>",
        description: "component type (functional, class)",
        defaultValue: "functional",
      },
      {
        flags: "--framework <framework>",
        description: "UI framework (react, vue, angular, svelte)",
        defaultValue: "react",
      },
      { flags: "--directory <dir>", description: "source directory path" },
      { flags: "--props <props>", description: "comma-separated list of component props" },
    ],
  },
  {
    name: "module <name>",
    description: "add a standalone module (e.g. utilities, helpers, data models)",
    entityType: "module",
    options: [
      {
        flags: "--language <lang>",
        description: "programming language (typescript, python, rust, go)",
        defaultValue: "typescript",
      },
      { flags: "--directory <dir>", description: "source directory path" },
      { flags: "--functions <functions>", description: "comma-separated list of main functions" },
      { flags: "--types <types>", description: "comma-separated list of exported types" },
    ],
  },
  {
    name: "task <title>",
    description: "add a task to track work on spec entities",
    entityType: "task",
    options: [
      {
        flags: "--type <type>",
        description: "task type (task, bug, feature, epic, story, spike)",
        defaultValue: "task",
      },
      {
        flags: "--status <status>",
        description: "task status (open, in_progress, blocked, review, done, closed)",
        defaultValue: "open",
      },
      {
        flags: "--priority <priority>",
        description: "priority level (critical, high, medium, low)",
      },
      { flags: "--assignee <name>", description: "assign to a person" },
      { flags: "--labels <labels>", description: "comma-separated labels" },
      { flags: "--refs <refs>", description: "comma-separated entity references (type:slug)" },
      { flags: "--milestone <milestone>", description: "milestone/group slug" },
      { flags: "--description <text>", description: "detailed description" },
    ],
  },
  {
    name: "note <content>",
    description: "add a note/comment attached to an entity",
    entityType: "note",
    options: [
      { flags: "--target <entity>", description: "target entity slug (required)" },
      {
        flags: "--kind <kind>",
        description: "note kind (discussion, guidance, memory, decision, note)",
        defaultValue: "note",
      },
      { flags: "--author <name>", description: "author name" },
      { flags: "--tags <tags>", description: "comma-separated tags" },
    ],
  },
];

/**
 * Create and register all add subcommands on the given program.
 * This is the main entry point for add command setup.
 *
 * @param program - The Commander program instance
 * @returns The add command with all subcommands registered
 */
/**
 * Parse unknown flags into a metadata object.
 * Unknown flags like --foo bar become { foo: "bar" }
 */
function parseUnknownFlags(args: string[]): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg?.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg is a value (not another flag)
      if (nextArg && !nextArg.startsWith("--")) {
        // Try to parse as number or boolean
        if (nextArg === "true") {
          metadata[key] = true;
        } else if (nextArg === "false") {
          metadata[key] = false;
        } else if (!isNaN(Number(nextArg))) {
          metadata[key] = Number(nextArg);
        } else {
          metadata[key] = nextArg;
        }
        i += 2;
      } else {
        // Flag without value is a boolean true
        metadata[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return metadata;
}

export function createAddCommands(program: Command): Command {
  const addCmd = program
    .command("add")
    .description("incrementally build CUE specifications with modular generators")
    .addHelpText(
      "after",
      `
${chalk.dim("Tip: You can attach arbitrary metadata using unknown flags:")}
  ${chalk.cyan("arbiter add package my-lib --custom-field value --another-field 123")}
`,
    );

  for (const config of ADD_SUBCOMMANDS) {
    let subCmd = addCmd.command(config.name).description(config.description);
    subCmd = addOptions(subCmd, [...config.options, ...COMMON_OPTIONS]);
    // Allow unknown options to be captured as metadata
    subCmd.allowUnknownOption(true);
    subCmd.action(createActionHandler(config.entityType, config.transformOptions));
  }

  return addCmd;
}
