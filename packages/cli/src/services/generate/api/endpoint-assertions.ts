/**
 * @packageDocumentation
 * Endpoint assertion test generation for various languages.
 *
 * Generates test files from CUE assertion definitions for TypeScript,
 * Python, Rust, and Go with appropriate testing framework integration.
 */

import path from "node:path";
import type { EndpointTestGenerationConfig } from "@/language-support/index.js";
import type {
  EndpointAssertionDefinition,
  EndpointTestCaseDefinition,
} from "@/language-support/index.js";
import { SUPPORTED_HTTP_METHODS } from "@/services/generate/api/route-derivation.js";
import { getConfiguredLanguagePlugin } from "@/services/generate/core/orchestration/template-orchestrator.js";
import { writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, toPathSegments } from "@/services/generate/util/shared.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { AppSpec, CueAssertion, CueAssertionBlock, PathSpec } from "@arbiter/specification";
import fs from "fs-extra";

const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

export const DEFAULT_TESTING_FRAMEWORKS: Record<string, string> = {
  javascript: "jest",
  typescript: "vitest",
  python: "pytest",
  rust: "builtin",
  go: "go-test",
};

/**
 * Preferred response status codes in order of priority
 */
const PREFERRED_RESPONSE_STATUSES = ["200", "201", "202", "204"];

/**
 * Find the primary response from a responses object
 */
function findPrimaryResponse(
  responses: Record<string, any> | undefined,
): { status: number; response: Record<string, unknown> } | null {
  if (!responses || typeof responses !== "object") {
    return null;
  }

  const entries = Object.entries(responses).filter(([status]) => status);
  const preferredEntry = entries.find(([status]) => PREFERRED_RESPONSE_STATUSES.includes(status));
  const chosen = preferredEntry ?? entries[0];

  if (!chosen) {
    return null;
  }

  return {
    status: Number.parseInt(chosen[0], 10),
    response: chosen[1] as Record<string, unknown>,
  };
}

/**
 * Extract content metadata from a content object (request or response body)
 */
function extractContentMetadata(
  contentObj: Record<string, Record<string, unknown>> | undefined,
): { contentType: string; schema: unknown; example: unknown } | null {
  if (!contentObj || typeof contentObj !== "object") {
    return null;
  }

  const [contentType, media] = Object.entries(contentObj)[0] ?? [];
  if (!contentType) {
    return null;
  }

  return {
    contentType,
    schema: media?.schema,
    example: media?.example,
  };
}

/**
 * Build metadata from request body and response
 */
function buildOperationMetadata(
  requestBody: Record<string, unknown> | undefined,
  primaryResponse: { status: number; response: Record<string, unknown> } | null,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (requestBody && typeof requestBody === "object") {
    const requestContent = extractContentMetadata(
      requestBody.content as Record<string, Record<string, unknown>> | undefined,
    );
    if (requestContent) {
      metadata.requestBody = requestContent;
    }
  }

  if (primaryResponse) {
    const responseContent = extractContentMetadata(
      primaryResponse.response.content as Record<string, Record<string, unknown>> | undefined,
    );
    if (responseContent) {
      metadata.response = {
        status: primaryResponse.status,
        ...responseContent,
      };
    }
  }

  return metadata;
}

/**
 * Process a single operation and return test case if valid
 */
function processOperation(
  pathKey: string,
  method: string,
  operation: Record<string, any>,
): EndpointTestCaseDefinition | null {
  const assertions = normalizeCueAssertionBlock(operation.assertions);
  if (assertions.length === 0) {
    return null;
  }

  const primaryResponse = findPrimaryResponse(operation.responses);
  const metadata = buildOperationMetadata(
    operation.requestBody as Record<string, unknown> | undefined,
    primaryResponse,
  );

  return {
    path: pathKey,
    method: method.toUpperCase(),
    assertions,
    status: primaryResponse?.status,
    metadata,
  };
}

/**
 * Collect endpoint assertion cases from app spec
 */
export function collectEndpointAssertionCases(appSpec: AppSpec): EndpointTestCaseDefinition[] {
  const cases: EndpointTestCaseDefinition[] = [];
  const pathGroups = (appSpec as any).paths ?? {};

  for (const pathSpec of Object.values(pathGroups)) {
    if (!pathSpec || typeof pathSpec !== "object") {
      continue;
    }

    for (const [pathKey, operationSet] of Object.entries(pathSpec as Record<string, PathSpec>)) {
      for (const method of SUPPORTED_HTTP_METHODS) {
        const operation = (operationSet as Record<string, any>)[method];
        if (!operation || typeof operation !== "object") {
          continue;
        }

        const testCase = processOperation(pathKey, method, operation);
        if (testCase) {
          cases.push(testCase);
        }
      }
    }
  }

  return cases;
}

/**
 * Normalize CUE assertion block
 */
export function normalizeCueAssertionBlock(
  block?: CueAssertionBlock,
): EndpointTestCaseDefinition["assertions"] {
  if (!block || typeof block !== "object") {
    return [];
  }

  const result: EndpointTestCaseDefinition["assertions"] = [];

  for (const [name, value] of Object.entries(block)) {
    const normalized = normalizeCueAssertion(name, value as CueAssertion);
    if (normalized) {
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Normalize boolean assertion to definition
 */
function normalizeBooleanAssertion(name: string, value: boolean): EndpointAssertionDefinition {
  return { name, result: value, severity: "error", raw: value };
}

/**
 * Normalize object assertion to definition
 */
function normalizeObjectAssertion(
  name: string,
  value: { severity?: string; tags?: unknown[]; assert?: unknown; message?: string },
): EndpointAssertionDefinition {
  const severity =
    value.severity === "warn" || value.severity === "info" ? value.severity : "error";
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  return {
    name,
    result: typeof value.assert === "boolean" ? value.assert : null,
    severity,
    message: value.message,
    tags,
    raw: value,
  };
}

/**
 * Normalize individual CUE assertion
 */
export function normalizeCueAssertion(
  name: string,
  value: CueAssertion,
): EndpointAssertionDefinition | null {
  if (typeof value === "boolean") {
    return normalizeBooleanAssertion(name, value);
  }
  if (value && typeof value === "object") {
    return normalizeObjectAssertion(name, value);
  }
  return null;
}

/**
 * Resolve testing framework for a language
 */
export function resolveTestingFramework(
  language: string,
  configuredFramework?: string | null,
): string {
  if (configuredFramework && configuredFramework.trim().length > 0) {
    return configuredFramework.trim().toLowerCase();
  }
  return DEFAULT_TESTING_FRAMEWORKS[language] ?? "vitest";
}

/**
 * Normalize JS framework
 */
export function normalizeJsFramework(
  language: "typescript" | "javascript",
  framework: string,
): "vitest" | "jest" {
  if (framework === "jest") {
    return "jest";
  }
  if (framework === "vitest") {
    return "vitest";
  }
  return language === "javascript" ? "jest" : "vitest";
}

/**
 * Normalize cases for serialization
 */
export function normalizeCasesForSerialization(cases: EndpointTestCaseDefinition[]): Array<{
  path: string;
  method: string;
  status: number | null;
  assertions: Array<{
    name: string;
    result: boolean | null;
    severity: string;
    message: string | null;
    tags: string[];
  }>;
}> {
  return cases.map(({ path, method, status, assertions }) => ({
    path,
    method,
    status: typeof status === "number" ? status : null,
    assertions: assertions.map((assertion) => ({
      name: assertion.name,
      result: assertion.result,
      severity: assertion.severity,
      message: assertion.message ?? null,
      tags: assertion.tags ?? [],
    })),
  }));
}

/**
 * Generate JS/TS endpoint assertion test
 */
export function generateJsTsEndpointAssertionTest(
  language: "typescript" | "javascript",
  framework: "vitest" | "jest",
  cases: EndpointTestCaseDefinition[],
): string {
  const payload = normalizeCasesForSerialization(cases);
  const serialized = JSON.stringify(payload, null, 2);
  const importLine =
    framework === "jest"
      ? "import { describe, it, expect } from '@jest/globals';"
      : "import { describe, it, expect } from 'vitest';";

  const typeDefinitions =
    language === "typescript"
      ? `\ntype EndpointAssertion = {\n  name: string;\n  result: boolean | null;\n  severity: 'error' | 'warn' | 'info';\n  message: string | null;\n  tags: string[];\n};\n\ntype EndpointTestCase = {\n  path: string;\n  method: string;\n  status: number | null;\n  assertions: EndpointAssertion[];\n};\n`
      : "";

  const casesDeclaration =
    language === "typescript"
      ? `const endpointCases: EndpointTestCase[] = ${serialized};`
      : `const endpointCases = ${serialized};`;

  return `// Generated by Arbiter - Endpoint assertion tests\n${importLine}${typeDefinitions}\n${casesDeclaration}\n\nendpointCases.forEach(({ method, path, assertions }) => {\n  describe(\`[\${method}] \${path}\`, () => {\n    assertions.forEach(assertion => {\n      const label = assertion.message || assertion.name;\n      const runner = assertion.result === null ? it.skip : it;\n      runner(label, () => {\n        expect(assertion.result, assertion.message || assertion.name).toBe(true);\n      });\n    });\n  });\n});\n`;
}

/**
 * Generate Python endpoint assertion test
 */
export function generatePythonEndpointAssertionTest(
  _framework: string,
  cases: EndpointTestCaseDefinition[],
): string {
  const serialized = JSON.stringify(normalizeCasesForSerialization(cases), null, 2);

  return `# Generated by Arbiter - Endpoint assertion tests\nimport json\nimport pytest\n\nENDPOINT_CASES = json.loads(r'''${serialized}''')\n\n@pytest.mark.parametrize("case", ENDPOINT_CASES, ids=lambda c: f"{c['method']} {c['path']}")\ndef test_endpoint_assertions(case):\n    for assertion in case['assertions']:\n        result = assertion.get('result')\n        message = assertion.get('message') or assertion['name']\n        if result is None:\n            pytest.skip(f"{message} marked as TODO")\n        assert result, message\n`;
}

/**
 * Generate Rust endpoint assertion test
 */
export function generateRustEndpointAssertionTest(cases: EndpointTestCaseDefinition[]): string {
  const renderedCases = normalizeCasesForSerialization(cases)
    .map((caseItem) => {
      const assertions = caseItem.assertions
        .map((assertion) => {
          const result =
            assertion.result === null ? "None" : `Some(${assertion.result ? "true" : "false"})`;
          const message = assertion.message
            ? `Some("${escapeRustString(assertion.message)}")`
            : "None";
          const tags =
            assertion.tags.length > 0
              ? `vec![${assertion.tags.map((tag) => `"${escapeRustString(tag)}"`).join(", ")}]`
              : "Vec::new()";

          return `                EndpointAssertion {\n                    name: "${escapeRustString(assertion.name)}",\n                    result: ${result},\n                    severity: "${escapeRustString(assertion.severity)}",\n                    message: ${message},\n                    tags: ${tags},\n                }`;
        })
        .join(",\n");

      const status = caseItem.status !== null ? `Some(${caseItem.status})` : "None";

      return `            EndpointCase {\n                path: "${escapeRustString(caseItem.path)}",\n                method: "${escapeRustString(caseItem.method)}",\n                status: ${status},\n                assertions: vec![\n${assertions}\n                ],\n            }`;
    })
    .join(",\n");

  return `// Generated by Arbiter - Endpoint assertion tests\n#[cfg(test)]\nmod tests {\n    struct EndpointAssertion<'a> {\n        name: &'a str,\n        result: Option<bool>,\n        severity: &'a str,\n        message: Option<&'a str>,\n        tags: Vec<&'a str>,\n    }\n\n    struct EndpointCase<'a> {\n        path: &'a str,\n        method: &'a str,\n        status: Option<u16>,\n        assertions: Vec<EndpointAssertion<'a>>,\n    }\n\n    fn endpoint_cases() -> Vec<EndpointCase<'static>> {\n        vec![\n${renderedCases}\n        ]\n    }\n\n    #[test]\n    fn endpoint_assertions_pass() {\n        for case in endpoint_cases() {\n            for assertion in case.assertions {\n                match assertion.result {\n                    Some(true) => {}\n                    Some(false) => {\n                        let message = assertion.message.unwrap_or(assertion.name);\n                        panic!("{} {} -> {} failed: {}", case.method, case.path, assertion.name, message);\n                    }\n                    None => {\n                        println!("skipping {} {} -> {}", case.method, case.path, assertion.name);\n                    }\n                }\n            }\n        }\n    }\n}\n`;
}

/**
 * Generate Go endpoint assertion test
 */
export function generateGoEndpointAssertionTest(cases: EndpointTestCaseDefinition[]): string {
  const serialized = JSON.stringify(normalizeCasesForSerialization(cases));
  const escaped = escapeGoString(serialized);

  return (
    `// Generated by Arbiter - Endpoint assertion tests\npackage assertions\n\nimport (\n    "encoding/json"\n    "testing"\n)\n\ntype EndpointAssertion struct {\n    Name     string   ` +
    '`json:"name"`' +
    `\n    Result   *bool    ` +
    '`json:"result"`' +
    `\n    Severity string   ` +
    '`json:"severity"`' +
    `\n    Message  *string  ` +
    '`json:"message"`' +
    `\n    Tags     []string ` +
    '`json:"tags"`' +
    `\n}\n\ntype EndpointCase struct {\n    Path       string              ` +
    '`json:"path"`' +
    `\n    Method     string              ` +
    '`json:"method"`' +
    `\n    Status     *int                ` +
    '`json:"status"`' +
    `\n    Assertions []EndpointAssertion ` +
    '`json:"assertions"`' +
    `\n}\n\nfunc loadEndpointCases(t *testing.T) []EndpointCase {\n    data := []byte("${escaped}")\n    var cases []EndpointCase\n    if err := json.Unmarshal(data, &cases); err != nil {\n        t.Fatalf("failed to parse endpoint cases: %v", err)\n    }\n    return cases\n}\n\nfunc TestEndpointAssertions(t *testing.T) {\n    cases := loadEndpointCases(t)\n    for _, c := range cases {\n        for _, assertion := range c.Assertions {\n            if assertion.Result == nil {\n                t.Logf("skipping %s %s -> %s", c.Method, c.Path, assertion.Name)\n                continue\n            }\n            if !*assertion.Result {\n                if assertion.Message != nil && *assertion.Message != "" {\n                    t.Fatalf("%s %s -> %s failed: %s", c.Method, c.Path, assertion.Name, *assertion.Message)\n                }\n                t.Fatalf("%s %s -> %s failed", c.Method, c.Path, assertion.Name)\n            }\n        }\n    }\n}\n`
  );
}

/**
 * Escape string for Rust
 */
export function escapeRustString(value: any): string {
  const text = value == null ? "" : String(value);
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Escape string for Go
 */
export function escapeGoString(value: any): string {
  const text = value == null ? "" : String(value);
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/**
 * Configuration for test directory setup
 */
interface TestDirConfig {
  testsDir: string;
  relativeDir: string;
  configuredSegments: string[];
}

/**
 * Result from plugin-based test generation
 */
interface PluginGenerationResult {
  handled: boolean;
  files: string[];
}

/**
 * Language-specific test generator definition
 */
interface LanguageTestGenerator {
  logMessage: string;
  fileName: string;
  generate: (cases: EndpointTestCaseDefinition[], framework: string) => string;
}

/**
 * Set up the test directory configuration
 */
function setupTestDirConfig(
  outputDir: string,
  structure: ProjectStructureConfig,
  testingConfig: any,
): TestDirConfig {
  const defaultDirSegments = [...toPathSegments(structure.testsDirectory), "api", "assertions"];
  const configuredSegments = testingConfig?.outputDir
    ? toPathSegments(testingConfig.outputDir)
    : defaultDirSegments;

  const testsDir =
    configuredSegments.length > 0 ? path.join(outputDir, ...configuredSegments) : outputDir;
  const relativeDir = configuredSegments.length > 0 ? joinRelativePath(...configuredSegments) : ".";

  return { testsDir, relativeDir, configuredSegments };
}

/**
 * Ensure test directory exists
 */
function ensureTestsDir(testsDir: string, dryRun: boolean): void {
  if (!fs.existsSync(testsDir) && !dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
}

function buildGenerationConfig(
  appSpec: AppSpec,
  cases: EndpointTestCaseDefinition[],
  dirConfig: TestDirConfig,
  language: string,
  testingConfig: any,
): EndpointTestGenerationConfig {
  return {
    app: appSpec,
    cases,
    outputDir: dirConfig.testsDir,
    relativeDir: dirConfig.relativeDir,
    language,
    testing: testingConfig,
  };
}

function computeRelativeFilePath(dirConfig: TestDirConfig, relativePath: string): string {
  const cleanPath = relativePath.replace(/^\.\//, "");
  return dirConfig.configuredSegments.length > 0
    ? joinRelativePath(...dirConfig.configuredSegments, cleanPath)
    : cleanPath;
}

async function writeGeneratedTestFiles(
  generation: {
    files: Array<{ path: string; content: string; executable?: boolean }>;
    instructions?: string[];
  },
  dirConfig: TestDirConfig,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  for (const file of generation.files) {
    const relativePath = file.path.replace(/^\/+/, "");
    const destination = path.join(dirConfig.testsDir, relativePath);
    const mode = file.executable ? 0o755 : undefined;

    await writeFileWithHooks(destination, file.content, options, mode);
    files.push(computeRelativeFilePath(dirConfig, relativePath));
  }

  if (generation.instructions?.length) {
    generation.instructions.forEach((instruction) => reporter.info(`✅ ${instruction}`));
  }

  return files;
}

/**
 * Try plugin-based test generation
 */
async function tryPluginGeneration(
  plugin: ReturnType<typeof getConfiguredLanguagePlugin>,
  appSpec: AppSpec,
  cases: EndpointTestCaseDefinition[],
  dirConfig: TestDirConfig,
  language: string,
  testingConfig: any,
  options: GenerateOptions,
): Promise<PluginGenerationResult> {
  if (!plugin?.generateEndpointTests) {
    return { handled: false, files: [] };
  }

  const generationConfig = buildGenerationConfig(
    appSpec,
    cases,
    dirConfig,
    language,
    testingConfig,
  );

  try {
    const generation = await plugin.generateEndpointTests(generationConfig);
    const files = await writeGeneratedTestFiles(generation, dirConfig, options);
    return { handled: generation.files.length > 0, files };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reporter.warn(
      `⚠️  Plugin endpoint test generation failed for ${plugin.name}, falling back to default: ${message}`,
    );
    return { handled: false, files: [] };
  }
}

/**
 * Get language-specific test generator configuration
 */
function getLanguageGenerator(language: string, framework: string): LanguageTestGenerator | null {
  switch (language) {
    case "typescript":
    case "javascript": {
      const normalized = language === "javascript" ? "javascript" : "typescript";
      const frameworkChoice = normalizeJsFramework(normalized, framework);
      return {
        logMessage: `   • Using ${frameworkChoice.toUpperCase()} template for ${normalized} endpoint assertions`,
        fileName: `endpoint-assertions.test.${normalized === "javascript" ? "js" : "ts"}`,
        generate: (cases) => generateJsTsEndpointAssertionTest(normalized, frameworkChoice, cases),
      };
    }
    case "python":
      return {
        logMessage: "   • Using PYTEST template for python endpoint assertions",
        fileName: "test_endpoint_assertions.py",
        generate: (cases) => generatePythonEndpointAssertionTest("pytest", cases),
      };
    case "rust":
      return {
        logMessage: "   • Using Rust std test template for endpoint assertions",
        fileName: "endpoint_assertions.rs",
        generate: (cases) => generateRustEndpointAssertionTest(cases),
      };
    case "go":
      return {
        logMessage: "   • Using Go testing template for endpoint assertions",
        fileName: "endpoint_assertions_test.go",
        generate: (cases) => generateGoEndpointAssertionTest(cases),
      };
    default:
      return null;
  }
}

/**
 * Generate test file using language-specific generator
 */
async function generateLanguageTest(
  generator: LanguageTestGenerator,
  cases: EndpointTestCaseDefinition[],
  framework: string,
  dirConfig: TestDirConfig,
  options: GenerateOptions,
): Promise<string> {
  reporter.info(generator.logMessage);
  const filePath = path.join(dirConfig.testsDir, generator.fileName);
  const content = generator.generate(cases, framework);
  await writeFileWithHooks(filePath, content, options);

  return dirConfig.configuredSegments.length > 0
    ? joinRelativePath(...dirConfig.configuredSegments, generator.fileName)
    : generator.fileName;
}

/**
 * Generate endpoint assertion tests for the application.
 */
export async function generateEndpointAssertionTests(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
): Promise<string[]> {
  const cases = collectEndpointAssertionCases(appSpec);
  if (cases.length === 0) {
    return [];
  }

  reporter.info("🧪 Generating endpoint assertion tests...");

  const language = (appSpec.config?.language || "typescript").toLowerCase();
  const testingConfig = cliConfig.generator?.plugins?.[language]?.testing;
  const framework = resolveTestingFramework(language, testingConfig?.framework);
  const plugin = getConfiguredLanguagePlugin(language);

  const dirConfig = setupTestDirConfig(outputDir, structure, testingConfig);
  ensureTestsDir(dirConfig.testsDir, options.dryRun);

  // Try plugin-based generation first
  const pluginResult = await tryPluginGeneration(
    plugin,
    appSpec,
    cases,
    dirConfig,
    language,
    testingConfig,
    options,
  );

  if (pluginResult.handled) {
    return pluginResult.files;
  }

  // Fall back to built-in generators
  const generator = getLanguageGenerator(language, framework);
  if (!generator) {
    reporter.info(
      `⚠️  Endpoint assertion tests not generated for language '${language}'. Provide a language plugin implementation or add a generator fallback.`,
    );
    return [];
  }

  const generatedFile = await generateLanguageTest(generator, cases, framework, dirConfig, options);
  return [generatedFile];
}
