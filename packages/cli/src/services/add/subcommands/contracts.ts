function normalizeContractKind(kind?: string): "workflows" | "events" {
  const normalized = kind ? kind.toString().toLowerCase() : "workflows";
  if (normalized.startsWith("event")) {
    return "events";
  }
  return "workflows";
}

function parseJsonExampleOption(
  label: string,
  raw?: string,
): { provided: boolean; value?: unknown } {
  if (raw === undefined) {
    return { provided: false };
  }
  const text = raw.trim();
  if (text.length === 0) {
    return { provided: false };
  }
  try {
    return { provided: true, value: JSON.parse(text) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON supplied to --${label}: ${reason}`);
  }
}

function formatSchemaReference(schema?: string): string | undefined {
  if (!schema) return undefined;
  const trimmed = schema.trim();
  if (trimmed.startsWith("#/") || trimmed.includes(".") || trimmed.includes("/")) {
    return trimmed;
  }
  return `#/components/schemas/${trimmed}`;
}

function upsertPayloadBlock(
  existing: unknown,
  key: string,
  schema: string | undefined,
  example: { provided: boolean; value?: unknown },
): Record<string, any> {
  const payload =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, any>) }
      : {};

  const nextKey = key || "payload";
  const details = { ...(payload[nextKey] ?? {}) };
  const schemaRef = formatSchemaReference(schema);
  if (schemaRef) {
    details.$ref = schemaRef;
  }
  if (example.provided) {
    details.example = example.value;
  }

  payload[nextKey] = details;
  return payload;
}

export async function addContractWorkflow(
  manipulator: any,
  content: string,
  workflowName: string,
  options: Record<string, any>,
): Promise<string> {
  const kind = normalizeContractKind(options.kind);
  const ast = await manipulator.parse(content);

  ast.contracts = ast.contracts ?? {};
  ast.contracts[kind] = ast.contracts[kind] ?? {};

  const existing = (ast.contracts[kind][workflowName] as Record<string, any>) ?? {};
  const workflow = { ...existing };

  if (typeof options.version === "string" && options.version.trim().length > 0) {
    workflow.version = options.version.trim();
  } else if (!workflow.version) {
    workflow.version = "1.0.0";
  }

  if (typeof options.summary === "string") {
    workflow.summary = options.summary;
  }

  if (typeof options.description === "string") {
    workflow.description = options.description;
  }

  workflow.operations = workflow.operations ?? existing.operations ?? {};
  ast.contracts[kind][workflowName] = workflow;

  return await manipulator.serialize(ast, content);
}

export async function addContractOperation(
  manipulator: any,
  content: string,
  contractName: string,
  operationName: string,
  options: Record<string, any>,
): Promise<string> {
  const kind = normalizeContractKind(options.kind);
  const ast = await manipulator.parse(content);

  const contractsOfKind = ast.contracts?.[kind];
  if (!contractsOfKind || !contractsOfKind[contractName]) {
    throw new Error(
      `Contract "${contractName}" (${kind}) not found. Run 'arbiter add contract ${contractName}' first.`,
    );
  }

  const workflow = contractsOfKind[contractName] as Record<string, any>;
  workflow.operations = workflow.operations ?? {};

  const existingOperation = workflow.operations[operationName] ?? {};
  const operation: Record<string, any> = { ...existingOperation };

  if (typeof options.summary === "string") {
    operation.summary = options.summary;
  }

  if (typeof options.description === "string") {
    operation.description = options.description;
  }

  const inputExample = parseJsonExampleOption("input-example", options.inputExample);
  const outputExample = parseJsonExampleOption("output-example", options.outputExample);

  if (
    (typeof options.inputSchema === "string" && options.inputSchema.trim().length > 0) ||
    inputExample.provided
  ) {
    const inputKey =
      typeof options.inputKey === "string" && options.inputKey.trim().length > 0
        ? options.inputKey.trim()
        : "payload";
    operation.input = upsertPayloadBlock(
      operation.input,
      inputKey,
      options.inputSchema,
      inputExample,
    );
  }

  if (
    (typeof options.outputSchema === "string" && options.outputSchema.trim().length > 0) ||
    outputExample.provided
  ) {
    const outputKey =
      typeof options.outputKey === "string" && options.outputKey.trim().length > 0
        ? options.outputKey.trim()
        : "result";
    operation.output = upsertPayloadBlock(
      operation.output,
      outputKey,
      options.outputSchema,
      outputExample,
    );
  }

  workflow.operations[operationName] = operation;

  return await manipulator.serialize(ast, content);
}
