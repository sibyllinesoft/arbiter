/**
 * @packageDocumentation
 * Contracts subcommand module - Handles adding contract definitions to CUE specifications.
 *
 * Supports defining:
 * - Workflow contracts with operations
 * - Event contracts with payloads
 * - Schema references and examples
 */

/** Contract type categorization */
type ContractKind = "workflows" | "events";
/** Result of parsing an optional JSON example */
type ParsedExample = { provided: boolean; value?: unknown };

/**
 * Normalize a contract kind string to a valid ContractKind.
 * @param kind - Optional kind string
 * @returns Normalized contract kind
 */
function normalizeContractKind(kind?: string): ContractKind {
  const normalized = kind?.toString().toLowerCase() ?? "workflows";
  return normalized.startsWith("event") ? "events" : "workflows";
}

/**
 * Parse a JSON example option string.
 * @param label - Option label for error messages
 * @param raw - Raw JSON string
 * @returns Parsed example result
 */
function parseJsonExampleOption(label: string, raw?: string): ParsedExample {
  if (!raw?.trim()) return { provided: false };

  try {
    return { provided: true, value: JSON.parse(raw.trim()) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON supplied to --${label}: ${reason}`);
  }
}

/**
 * Check if a schema reference is already fully qualified.
 * @param schema - Schema reference string
 * @returns True if the reference is already qualified
 */
function isAlreadyQualifiedRef(schema: string): boolean {
  return schema.startsWith("#/") || schema.includes(".") || schema.includes("/");
}

/**
 * Format a schema name as a JSON reference.
 * @param schema - Schema name or reference
 * @returns Formatted schema reference or undefined
 */
function formatSchemaReference(schema?: string): string | undefined {
  const trimmed = schema?.trim();
  if (!trimmed) return undefined;
  return isAlreadyQualifiedRef(trimmed) ? trimmed : `#/components/schemas/${trimmed}`;
}

/**
 * Convert an existing value to a Record type.
 * @param existing - Existing value to convert
 * @returns Record object
 */
function toRecord(existing: unknown): Record<string, unknown> {
  return existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};
}

/**
 * Upsert a payload block with schema and example.
 * @param existing - Existing payload object
 * @param key - Payload key name
 * @param schema - Optional schema reference
 * @param example - Parsed example
 * @returns Updated payload object
 */
function upsertPayloadBlock(
  existing: unknown,
  key: string,
  schema: string | undefined,
  example: ParsedExample,
): Record<string, unknown> {
  const payload = toRecord(existing);
  const nextKey = key || "payload";
  const details: Record<string, unknown> = {
    ...((payload[nextKey] as Record<string, unknown>) ?? {}),
  };

  const schemaRef = formatSchemaReference(schema);
  if (schemaRef) details.$ref = schemaRef;
  if (example.provided) details.example = example.value;

  payload[nextKey] = details;
  return payload;
}

/**
 * Check if a value is a non-empty string.
 * @param value - Value to check
 * @returns True if the value is a non-empty string
 */
function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Apply a string option to a target object if the value is a string.
 * @param target - Target object to modify
 * @param key - Key to set
 * @param value - Value to apply
 */
function applyStringOption(target: Record<string, unknown>, key: string, value: unknown): void {
  if (typeof value === "string") target[key] = value;
}

/**
 * Ensure nested objects exist in an AST.
 * @param ast - AST object to modify
 * @param keys - Keys to ensure exist as nested objects
 * @returns The deepest nested object
 */
function ensureNestedObject(
  ast: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  let current = ast;
  for (const key of keys) {
    current[key] = current[key] ?? {};
    current = current[key] as Record<string, unknown>;
  }
  return current;
}

/**
 * Add a contract workflow to the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param workflowName - Name of the workflow
 * @param options - Workflow configuration options
 * @returns Updated CUE file content
 */
export async function addContractWorkflow(
  manipulator: {
    parse: (c: string) => Promise<Record<string, unknown>>;
    serialize: (a: Record<string, unknown>, c: string) => Promise<string>;
  },
  content: string,
  workflowName: string,
  options: Record<string, unknown>,
): Promise<string> {
  const kind = normalizeContractKind(options.kind as string | undefined);
  const ast = await manipulator.parse(content);
  const contractsOfKind = ensureNestedObject(ast, "contracts", kind);

  const existing = (contractsOfKind[workflowName] as Record<string, unknown>) ?? {};
  const workflow: Record<string, unknown> = { ...existing };

  workflow.version = hasNonEmptyString(options.version)
    ? options.version.trim()
    : (workflow.version ?? "1.0.0");

  applyStringOption(workflow, "summary", options.summary);
  applyStringOption(workflow, "description", options.description);

  workflow.operations = workflow.operations ?? existing.operations ?? {};
  contractsOfKind[workflowName] = workflow;

  return await manipulator.serialize(ast, content);
}

/**
 * Get a contract from the AST by kind and name.
 * @param ast - AST object
 * @param kind - Contract kind
 * @param contractName - Name of the contract
 * @returns Contract object
 */
function getContract(
  ast: Record<string, unknown>,
  kind: ContractKind,
  contractName: string,
): Record<string, unknown> {
  const contractsOfKind = (ast.contracts as Record<string, Record<string, unknown>> | undefined)?.[
    kind
  ];
  const contract = contractsOfKind?.[contractName];
  if (!contract) {
    throw new Error(
      `Contract "${contractName}" (${kind}) not found. Run 'arbiter add contract ${contractName}' first.`,
    );
  }
  return contract as Record<string, unknown>;
}

/**
 * Determine if a payload should be applied based on schema and example.
 * @param schema - Schema reference
 * @param example - Parsed example
 * @returns True if payload should be applied
 */
function shouldApplyPayload(schema: unknown, example: ParsedExample): boolean {
  return hasNonEmptyString(schema) || example.provided;
}

/**
 * Resolve a key value with a fallback.
 * @param key - Key value to resolve
 * @param fallback - Fallback value if key is not a non-empty string
 * @returns Resolved key string
 */
function resolveKey(key: unknown, fallback: string): string {
  return hasNonEmptyString(key) ? key.trim() : fallback;
}

/**
 * Add an operation to a contract in the CUE specification.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param contractName - Name of the parent contract
 * @param operationName - Name of the operation
 * @param options - Operation configuration options
 * @returns Updated CUE file content
 */
export async function addContractOperation(
  manipulator: {
    parse: (c: string) => Promise<Record<string, unknown>>;
    serialize: (a: Record<string, unknown>, c: string) => Promise<string>;
  },
  content: string,
  contractName: string,
  operationName: string,
  options: Record<string, unknown>,
): Promise<string> {
  const kind = normalizeContractKind(options.kind as string | undefined);
  const ast = await manipulator.parse(content);
  const workflow = getContract(ast, kind, contractName);

  workflow.operations = workflow.operations ?? {};
  const operations = workflow.operations as Record<string, unknown>;
  const existingOperation = (operations[operationName] as Record<string, unknown>) ?? {};
  const operation: Record<string, unknown> = { ...existingOperation };

  applyStringOption(operation, "summary", options.summary);
  applyStringOption(operation, "description", options.description);

  const inputExample = parseJsonExampleOption(
    "input-example",
    options.inputExample as string | undefined,
  );
  const outputExample = parseJsonExampleOption(
    "output-example",
    options.outputExample as string | undefined,
  );

  if (shouldApplyPayload(options.inputSchema, inputExample)) {
    operation.input = upsertPayloadBlock(
      operation.input,
      resolveKey(options.inputKey, "payload"),
      options.inputSchema as string | undefined,
      inputExample,
    );
  }

  if (shouldApplyPayload(options.outputSchema, outputExample)) {
    operation.output = upsertPayloadBlock(
      operation.output,
      resolveKey(options.outputKey, "result"),
      options.outputSchema as string | undefined,
      outputExample,
    );
  }

  operations[operationName] = operation;
  return await manipulator.serialize(ast, content);
}
