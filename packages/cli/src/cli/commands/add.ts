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
  | "flow"
  | "locator"
  | "schema"
  | "package"
  | "component"
  | "module";

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
  transformOptions?: (options: AddOptions, name: string) => { name: string; options: AddOptions };
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
    nameOrArg1: string,
    optionsOrArg2: AddOptions | string,
    maybeOptionsOrCommand?: AddOptions | Command,
    maybeCommand?: Command,
  ) => {
    // Handle both single and double argument commands
    let name: string;
    let options: AddOptions;
    let command: Command;

    if (typeof optionsOrArg2 === "string") {
      // Double argument: contract-operation <contract> <operation>
      name = optionsOrArg2; // operation is the name
      options = maybeOptionsOrCommand as AddOptions;
      options = { ...options, contract: nameOrArg1 }; // contract is first arg
      command = maybeCommand as Command;
    } else if (maybeOptionsOrCommand instanceof Command) {
      // Single argument with Command
      name = nameOrArg1;
      options = optionsOrArg2;
      command = maybeOptionsOrCommand;
    } else {
      // Single argument
      name = nameOrArg1;
      options = optionsOrArg2;
      command = maybeOptionsOrCommand as Command;
    }

    try {
      const config = requireCommandConfig(command);

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
      cmd = cmd.option(opt.flags, opt.description, opt.defaultValue);
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
    name: "flow <id>",
    description: "add a user flow for testing and validation",
    entityType: "flow",
    options: [
      { flags: "--description <description>", description: "flow description" },
      {
        flags: "--steps <steps>",
        description: 'JSON array of flow steps (e.g. "[{"visit":"/"}]")',
      },
      { flags: "--expected-outcome <outcome>", description: "expected outcome of the flow" },
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
];

/**
 * Create and register all add subcommands on the given program.
 * This is the main entry point for add command setup.
 *
 * @param program - The Commander program instance
 * @returns The add command with all subcommands registered
 */
export function createAddCommands(program: Command): Command {
  const addCmd = program
    .command("add")
    .description("incrementally build CUE specifications with modular generators");

  for (const config of ADD_SUBCOMMANDS) {
    let subCmd = addCmd.command(config.name).description(config.description);
    subCmd = addOptions(subCmd, [...config.options, ...COMMON_OPTIONS]);
    subCmd.action(createActionHandler(config.entityType, config.transformOptions));
  }

  return addCmd;
}
