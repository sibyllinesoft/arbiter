#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import yaml from "yaml";
import {
  createClaudeCodeDurableObjectConfig,
  createClaudeDurableObjectConfig,
  createCodexDurableObjectConfig,
  createOtelCollectorDurableObjectConfig,
} from "../apps/api/src/handlers/cloudflare/templates.ts";
import type { CloudflareDurableObjectHandlerConfig } from "../apps/api/src/handlers/types.ts";

interface HandlerRegistryConfig {
  imagePrefix?: string;
  push?: boolean;
  tagFormat?: string;
}

interface HandlerApiConfig {
  url?: string;
  token?: string;
}

interface HandlerDefaultsConfig {
  provider?: "github" | "gitlab";
  event?: string;
  template?: "codex" | "claude" | "claude-code" | "otel-collector";
  name?: string;
  description?: string;
  version?: string;
  enabled?: boolean;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  forwardSecrets?: string[];
  environment?: Record<string, string>;
  requiredPermissions?: string[];
}

interface CloudflareR2Config {
  bucket?: string;
  basePrefix?: string;
  region?: string;
  endpoint?: string;
  createIfMissing?: boolean;
}

interface HandlersCloudflareConfig {
  endpoint?: string;
  objectName?: string;
  namespace?: string;
  route?: string;
  headers?: Record<string, string>;
  forwardSecrets?: string[];
  timeoutMs?: number;
  retries?: number;
  accountId?: string;
  workerName?: string;
  compatibilityDate?: string;
  wranglerFile?: string;
  apiToken?: string;
  r2?: CloudflareR2Config;
}

interface ArbiterHandlersConfig {
  api?: HandlerApiConfig;
  registry?: HandlerRegistryConfig;
  defaults?: HandlerDefaultsConfig;
  cloudflare?: HandlersCloudflareConfig;
}

interface ArbiterConfig {
  handlers?: ArbiterHandlersConfig;
}

interface PublishArgs {
  dockerfile: string;
  contextDir: string;
  provider: "github" | "gitlab";
  event: string;
  template: "codex" | "claude" | "claude-code" | "otel-collector";
  imageTag: string;
  imageName: string;
  tagSuffix: string;
  handlerName: string;
  handlerDescription: string;
  handlerVersion: string;
  endpoint: string;
  namespace: string;
  objectName: string;
  route?: string;
  pushImage: boolean;
  apiUrl: string;
  apiToken?: string;
  forwardSecrets: string[];
  timeoutMs: number;
  retries: number;
  headers: Record<string, string>;
  requiredPermissions: string[];
  environment: Record<string, string>;
  r2Bucket?: string;
  r2BasePrefix: string;
  r2Region: string;
  r2Endpoint?: string;
  createR2Bucket: boolean;
  cloudflareApiToken?: string;
  accountId: string;
  workerName: string;
  compatibilityDate: string;
  wranglerFile: string;
}

const CONFIG_SEARCH_PATHS = [
  ".arbiter/config.json",
  ".arbiter/config.yaml",
  ".arbiter/config.yml",
  ".arbiter.json",
  ".arbiter.yaml",
  ".arbiter.yml",
];

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadArbiterConfig(): Promise<ArbiterConfig> {
  for (const relativePath of CONFIG_SEARCH_PATHS) {
    const absolutePath = path.resolve(relativePath);
    if (await pathExists(absolutePath)) {
      const content = await readFile(absolutePath, "utf-8");
      if (absolutePath.endsWith(".json")) {
        return JSON.parse(content) as ArbiterConfig;
      }
      return yaml.parse(content) as ArbiterConfig;
    }
  }
  throw new Error("Unable to locate .arbiter config (expected config.json/.yaml).");
}

type ArgMap = Record<string, string | boolean>;

function parseArgs(argv: string[]): ArgMap {
  const result: ArgMap = {};
  const args = [...argv];
  while (args.length > 0) {
    const token = args.shift()!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      if (key.startsWith("no-")) {
        result[key.slice(3)] = false;
        continue;
      }
      const nextValue = args[0];
      if (!nextValue || nextValue.startsWith("--")) {
        result[key] = true;
        continue;
      }
      result[key] = args.shift()!;
    } else if (!result._dockerfile) {
      result._dockerfile = token;
    } else {
      throw new Error(`Unexpected argument: ${token}`);
    }
  }
  return result;
}

function resolveString(value: string | boolean | undefined, fallback?: string): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return undefined;
}

function resolveBoolean(
  value: string | boolean | undefined,
  fallback?: boolean,
): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function ensureString(value: string | undefined, message: string): string {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

function sanitizeHeaderRecord(record?: Record<string, string>): Record<string, string> {
  if (!record) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") {
      result[key.toLowerCase()] = value;
    }
  }
  return result;
}

function uniqueTagSuffix(format?: string): string {
  if (format && format.includes("%")) {
    const now = new Date();
    return format
      .replace(/%Y/g, `${now.getUTCFullYear()}`)
      .replace(/%m/g, `${now.getUTCMonth() + 1}`.padStart(2, "0"))
      .replace(/%d/g, `${now.getUTCDate()}`.padStart(2, "0"))
      .replace(/%H/g, `${now.getUTCHours()}`.padStart(2, "0"))
      .replace(/%M/g, `${now.getUTCMinutes()}`.padStart(2, "0"))
      .replace(/%S/g, `${now.getUTCSeconds()}`.padStart(2, "0"))
      .replace(/%L/g, `${now.getUTCMilliseconds()}`.padStart(3, "0"));
  }
  return new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
}

function sanitizeIdentifier(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pascalCase(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join("");
}

function deriveDurableObjectIdentifiers(objectName: string): {
  bindingName: string;
  className: string;
} {
  const bindingName = objectName.replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
  const className = pascalCase(bindingName.toLowerCase());
  return { bindingName, className };
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function selectTemplateBuilder(template: "codex" | "claude" | "claude-code" | "otel-collector") {
  switch (template) {
    case "codex":
      return createCodexDurableObjectConfig;
    case "claude":
      return createClaudeDurableObjectConfig;
    case "otel-collector":
      return createOtelCollectorDurableObjectConfig;
    case "claude-code":
    default:
      return createClaudeCodeDurableObjectConfig;
  }
}

function buildHandlerModule(
  cloudflareConfig: CloudflareDurableObjectHandlerConfig,
  metadata: {
    name: string;
    description: string;
    version: string;
    requiredPermissions: string[];
    event: string;
  },
  handlerConfig: {
    enabled: boolean;
    timeout: number;
    retries: number;
    environment: Record<string, string>;
    secrets: Record<string, string>;
  },
): string {
  const source = {
    cloudflare: cloudflareConfig,
    config: handlerConfig,
    metadata: {
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      supportedEvents: [metadata.event],
      requiredPermissions: metadata.requiredPermissions,
    },
  };
  const moduleLiteral = JSON.stringify(source, null, 2);
  return `module.exports = ${moduleLiteral};\n`;
}

async function buildPublishArgs(): Promise<PublishArgs> {
  const argv = parseArgs(process.argv.slice(2));
  const config = await loadArbiterConfig();
  const handlersConfig = config.handlers ?? {};

  const dockerfileArg = resolveString(
    argv.dockerfile as string | undefined,
    argv._dockerfile as string | undefined,
  );
  const dockerfile = ensureString(dockerfileArg, "A Dockerfile path is required.");
  const dockerfilePath = path.resolve(dockerfile);
  if (!(await pathExists(dockerfilePath))) {
    throw new Error(`Dockerfile not found at ${dockerfilePath}`);
  }

  const contextDir = path.resolve(
    resolveString(argv.context as string | undefined, path.dirname(dockerfilePath))!,
  );

  const registryConfig = handlersConfig.registry ?? {};
  const imagePrefix = resolveString(
    argv["image-prefix"] as string | undefined,
    registryConfig.imagePrefix,
  );
  const templateName = (resolveString(
    argv.template as string | undefined,
    handlersConfig.defaults?.template,
  ) ?? "claude-code") as "codex" | "claude" | "claude-code" | "otel-collector";

  const contextName = resolveString(
    argv["image-name"] as string | undefined,
    path.basename(contextDir),
  )!;
  const tagSuffix = resolveString(
    argv.tag as string | undefined,
    uniqueTagSuffix(registryConfig.tagFormat),
  );

  const provider = (resolveString(
    argv.provider as string | undefined,
    handlersConfig.defaults?.provider,
  ) ?? "github") as "github" | "gitlab";
  const event =
    resolveString(argv.event as string | undefined, handlersConfig.defaults?.event) ?? "push";

  const apiConfig = handlersConfig.api ?? {};
  const apiUrl = ensureString(
    resolveString(argv["api-url"] as string | undefined, apiConfig.url),
    "handlers.api.url must be set in .arbiter config or provided via --api-url.",
  );
  const apiToken = resolveString(
    argv["api-token"] as string | undefined,
    apiConfig.token ?? process.env.ARBITER_API_TOKEN,
  );

  const cloudflareConfig = handlersConfig.cloudflare ?? {};
  const r2Config = cloudflareConfig.r2 ?? {};
  const cloudflareApiToken = resolveString(
    argv["cloudflare-api-token"] as string | undefined,
    cloudflareConfig.apiToken ?? process.env.CLOUDFLARE_API_TOKEN,
  );
  const accountId = ensureString(
    resolveString(argv["account-id"] as string | undefined, cloudflareConfig.accountId),
    "handlers.cloudflare.accountId must be set in .arbiter config or provided via --account-id.",
  );
  const workerName = ensureString(
    resolveString(
      argv["worker-name"] as string | undefined,
      cloudflareConfig.workerName ??
        `${sanitizeIdentifier(provider)}-${sanitizeIdentifier(event)}-${sanitizeIdentifier(templateName)}`,
    ),
    "handlers.cloudflare.workerName must be set in config or provided via --worker-name.",
  );
  const compatibilityDate = resolveString(
    argv["compatibility-date"] as string | undefined,
    cloudflareConfig.compatibilityDate ?? new Date().toISOString().split("T")[0],
  )!;
  const wranglerFile = resolveString(
    argv["wrangler-file"] as string | undefined,
    cloudflareConfig.wranglerFile ?? "wrangler.generated.toml",
  )!;

  const endpoint = ensureString(
    resolveString(argv.endpoint as string | undefined, cloudflareConfig.endpoint),
    "handlers.cloudflare.endpoint must be set in .arbiter config or provided via --endpoint.",
  );
  const namespace = ensureString(
    resolveString(argv.namespace as string | undefined, cloudflareConfig.namespace),
    "handlers.cloudflare.namespace must be set in .arbiter config or provided via --namespace.",
  );
  const objectName = ensureString(
    resolveString(argv["object-name"] as string | undefined, cloudflareConfig.objectName),
    "handlers.cloudflare.objectName must be set in .arbiter config or provided via --object-name.",
  );
  const route = resolveString(argv.route as string | undefined, cloudflareConfig.route);

  const r2Bucket = resolveString(argv["r2-bucket"] as string | undefined, r2Config.bucket);
  const r2BasePrefix =
    resolveString(argv["r2-prefix"] as string | undefined, r2Config.basePrefix ?? "otel/traces") ??
    "otel/traces";
  const r2Region =
    resolveString(argv["r2-region"] as string | undefined, r2Config.region ?? "auto") ?? "auto";
  let r2Endpoint = resolveString(argv["r2-endpoint"] as string | undefined, r2Config.endpoint);
  if (!r2Endpoint) {
    r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }
  const createR2Bucket =
    resolveBoolean(
      argv["create-r2-bucket"] as string | boolean | undefined,
      r2Config.createIfMissing,
    ) ?? false;

  if (templateName === "otel-collector" && !r2Bucket) {
    throw new Error(
      "Specify an R2 bucket via --r2-bucket or handlers.cloudflare.r2.bucket for the otel-collector template.",
    );
  }

  let forwardSecrets = resolveString(argv["forward-secrets"] as string | undefined)
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ??
    cloudflareConfig.forwardSecrets ??
    handlersConfig.defaults?.forwardSecrets ?? ["CLOUDFLARE_API_TOKEN"];

  if (templateName === "otel-collector") {
    for (const secret of ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_SESSION_TOKEN"]) {
      if (!forwardSecrets.includes(secret)) {
        forwardSecrets.push(secret);
      }
    }
  }

  const timeoutMs = Number(
    resolveString(
      argv.timeout as string | undefined,
      (cloudflareConfig.timeoutMs ?? handlersConfig.defaults?.timeout ?? 60000).toString(),
    ),
  );
  const retries = Number(
    resolveString(
      argv.retries as string | undefined,
      (cloudflareConfig.retries ?? handlersConfig.defaults?.retries ?? 1).toString(),
    ),
  );

  const handlerName = resolveString(
    argv.name as string | undefined,
    handlersConfig.defaults?.name ?? `${provider}-${event}-${templateName}-handler`,
  )!;
  const handlerDescription = resolveString(
    argv.description as string | undefined,
    handlersConfig.defaults?.description ?? "Cloudflare container-backed webhook handler.",
  )!;
  const handlerVersion = resolveString(
    argv.version as string | undefined,
    handlersConfig.defaults?.version ?? "0.1.0",
  )!;

  const headersFromArgs = sanitizeHeaderRecord(
    JSON.parse(resolveString(argv.headers as string | undefined, "{}")),
  );
  const mergedHeaders = {
    ...sanitizeHeaderRecord(handlersConfig.defaults?.headers),
    ...sanitizeHeaderRecord(cloudflareConfig.headers),
    ...headersFromArgs,
  };

  const requiredPermissions = handlersConfig.defaults?.requiredPermissions ?? [
    "cloudflare:durable-object",
  ];

  const environment = handlersConfig.defaults?.environment ?? {};

  const pushImage =
    argv.push === false
      ? false
      : argv["no-push"] === true
        ? false
        : argv["push"] === true
          ? true
          : registryConfig.push !== false;

  if (!imagePrefix) {
    throw new Error("handlers.registry.imagePrefix must be defined or pass --image-prefix.");
  }

  const sanitizedPrefix = imagePrefix.replace(/\/$/, "");
  const imageTag = `${sanitizedPrefix}/${contextName}:${tagSuffix}`;

  return {
    dockerfile: dockerfilePath,
    contextDir,
    provider,
    event,
    template: templateName,
    imageTag,
    imageName: contextName,
    tagSuffix,
    handlerName,
    handlerDescription,
    handlerVersion,
    endpoint,
    namespace,
    objectName,
    route,
    pushImage,
    apiUrl,
    apiToken,
    forwardSecrets,
    timeoutMs,
    retries,
    headers: mergedHeaders,
    requiredPermissions,
    environment,
    r2Bucket,
    r2BasePrefix,
    r2Region,
    r2Endpoint,
    createR2Bucket,
    cloudflareApiToken,
    accountId,
    workerName,
    compatibilityDate,
    wranglerFile,
  };
}

async function ensureR2Bucket(args: PublishArgs): Promise<void> {
  if (args.template !== "otel-collector" || !args.createR2Bucket) {
    return;
  }
  if (!args.r2Bucket) {
    throw new Error("R2 bucket name is required when --create-r2-bucket is set.");
  }
  const token = args.cloudflareApiToken ?? process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error(
      "Set CLOUDFLARE_API_TOKEN or pass --cloudflare-api-token to create R2 buckets automatically.",
    );
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${args.accountId}/r2/buckets/${args.r2Bucket}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  console.log(`
🪣 Ensuring R2 bucket "${args.r2Bucket}" exists`);

  let response = await fetch(baseUrl, { method: "GET", headers });
  if (response.ok) {
    console.log("   Bucket already present.");
    return;
  }
  if (response.status && response.status !== 404) {
    console.warn(`   Unable to verify bucket existence (${response.status}). Attempting create.`);
  }

  response = await fetch(baseUrl, { method: "PUT", headers });
  if (response.ok || response.status === 409) {
    console.log(response.status === 409 ? "   Bucket already exists." : "   Bucket created.");
    return;
  }

  const errorBody = await response.text();
  throw new Error(
    `Failed to create R2 bucket: ${response.status} ${response.statusText} ${errorBody}`,
  );
}

async function publishHandler() {
  const args = await buildPublishArgs();

  await ensureR2Bucket(args);

  const dockerBuildArgs = ["build", "-f", args.dockerfile, "-t", args.imageTag, args.contextDir];
  console.log(`\n🛠️  Building handler image: docker ${dockerBuildArgs.join(" ")}`);
  await runCommand("docker", dockerBuildArgs);

  if (args.pushImage) {
    console.log(`\n🚀 Pushing handler image: docker push ${args.imageTag}`);
    await runCommand("docker", ["push", args.imageTag]);
  } else {
    console.log("\nℹ️  Skipping docker push (push disabled).");
  }

  const templateBuilder = selectTemplateBuilder(args.template);
  const handlerConfig = templateBuilder({
    endpoint: args.endpoint,
    objectName: args.objectName,
    namespace: args.namespace,
    route: args.route,
    headers: Object.keys(args.headers).length > 0 ? args.headers : undefined,
    forwardSecrets: args.forwardSecrets,
    timeoutMs: args.timeoutMs,
    containerOverrides: {
      image: args.imageTag,
    },
  });

  if (args.template === "otel-collector" && handlerConfig.container) {
    handlerConfig.container.environment = {
      ...handlerConfig.container.environment,
      ...(args.r2Bucket ? { R2_BUCKET: args.r2Bucket } : {}),
      R2_BASE_PREFIX: args.r2BasePrefix,
      R2_REGION: args.r2Region,
      ...(args.r2Endpoint ? { R2_S3_ENDPOINT: args.r2Endpoint } : {}),
    };
  }

  const handlerModule = buildHandlerModule(
    handlerConfig,
    {
      name: args.handlerName,
      description: args.handlerDescription,
      version: args.handlerVersion,
      requiredPermissions: args.requiredPermissions,
      event: args.event,
    },
    {
      enabled: true,
      timeout: args.timeoutMs,
      retries: args.retries,
      environment: args.environment,
      secrets: Object.fromEntries(args.forwardSecrets.map((secret) => [secret, ""])),
    },
  );

  const requestBody = {
    provider: args.provider,
    event: args.event,
    code: handlerModule,
  };

  const apiUrl = args.apiUrl.replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/api/handlers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(args.apiToken ? { Authorization: `Bearer ${args.apiToken}` } : {}),
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to register handler: ${response.status} ${response.statusText} ${errorText}`,
    );
  }

  await ensureWranglerConfig(args);
  await ensureWorkerEntrypoint(args);

  const payload = (await response.json()) as {
    success: boolean;
    handler?: { id: string; provider: string; event: string };
    message?: string;
  };

  if (!payload.success) {
    throw new Error(`Handler registration failed: ${payload.message ?? "unknown error"}`);
  }

  console.log("\n✅ Handler registered with Arbiter service");
  if (payload.handler) {
    console.log(`   id: ${payload.handler.id}`);
    console.log(`   provider: ${payload.handler.provider}`);
    console.log(`   event: ${payload.handler.event}`);
  }
}

async function ensureWranglerConfig(args: PublishArgs): Promise<void> {
  const filePath = path.join(args.contextDir, args.wranglerFile);
  if (await pathExists(filePath)) {
    console.log(`
ℹ️  Wrangler config already exists at ${filePath}`);
    return;
  }
  const { bindingName, className } = deriveDurableObjectIdentifiers(args.objectName);
  const compatibilityDate = args.compatibilityDate;
  const content = `# Generated by Arbiter. Review before deploying.
name = "${args.workerName}"
main = "./worker.ts"
account_id = "${args.accountId}"
compatibility_date = "${compatibilityDate}"

[vars]
ARBITER_HANDLER_IMAGE = "${args.imageTag}"
ARBITER_HANDLER_ENDPOINT = "${args.endpoint}"
ARBITER_HANDLER_NAMESPACE = "${args.namespace}"
ARBITER_HANDLER_OBJECT = "${args.objectName}"
ARBITER_CONTAINER_FORWARD_ENV = "ARBITER_KV,ARBITER_BUCKET"

[[durable_objects.bindings]]
name = "${bindingName}"
class_name = "${className}"

[[d1_databases]]
binding = "ARBITER_DB"
database_name = "arbiter"
database_id = "8429ba62-bdee-4722-8ea5-dc1970960b65"

[[kv_namespaces]]
binding = "ARBITER_KV"
id = "e3147cc1737b402aafefd246a0238909"

[[r2_buckets]]
binding = "ARBITER_BUCKET"
bucket_name = "arbiter"

# TODO: add migrations, routes, and any additional bindings specific to your deployment.
`;
  await writeFile(filePath, content, "utf-8");
  console.log(`
📝 Created wrangler template at ${filePath}`);
}

async function ensureWorkerEntrypoint(args: PublishArgs): Promise<void> {
  const workerPath = path.join(args.contextDir, "worker.ts");
  if (await pathExists(workerPath)) {
    console.log(`
ℹ️  Worker entrypoint already exists at ${workerPath}`);
    return;
  }

  const templatePath = path.resolve("handlers/templates/cloudflare/worker-template.ts");
  const template = await readFile(templatePath, "utf-8");
  const { bindingName, className } = deriveDurableObjectIdentifiers(args.objectName);

  const rendered = template
    .replace(/\${BINDING_NAME}/g, bindingName)
    .replace(/\${OBJECT_NAME}/g, args.objectName)
    .replace(/\${CLASS_NAME}/g, className);

  await writeFile(workerPath, rendered, "utf-8");
  console.log(`
🛠️  Created Cloudflare worker entrypoint at ${workerPath}`);
}

publishHandler().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
