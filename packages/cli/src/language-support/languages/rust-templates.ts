/**
 * Rust template generation helpers
 *
 * Contains simple template generation methods for Rust projects.
 */

import type { BuildConfig, ProjectConfig } from "@/language-support/index.js";
import { TemplateResolver } from "@/language-support/template-resolver.js";

const rustTemplateResolver = new TemplateResolver({
  language: "rust",
  defaultDirectories: [
    new URL("@/language-support/templates/rust", import.meta.url).pathname,
    new URL("@/templates/rust", import.meta.url).pathname,
  ],
});

/**
 * Generate errors module
 */
export async function generateErrors(): Promise<string> {
  return rustTemplateResolver.renderTemplate("src/errors.rs.tpl", {});
}

/**
 * Generate models module
 */
export async function generateModelsModule(): Promise<string> {
  return "// Models module\npub mod user;\n";
}

/**
 * Generate services module
 */
export async function generateServicesModule(): Promise<string> {
  return "// Services module\n";
}

/**
 * Generate handlers module
 */
export async function generateHandlersModule(): Promise<string> {
  return "pub mod health;\n";
}

/**
 * Generate routes module
 */
export async function generateRoutesModule(_config: ProjectConfig): Promise<string> {
  return "// Routes module\npub mod api;\n";
}

/**
 * Generate middleware module
 */
export async function generateMiddlewareModule(): Promise<string> {
  return "// Middleware module\n";
}

/**
 * Generate health handler
 */
export async function generateHealthHandler(): Promise<string> {
  return rustTemplateResolver.renderTemplate("src/handlers/health.rs.tpl", {});
}

/**
 * Generate lib file
 */
export async function generateLibFile(config: ProjectConfig): Promise<string> {
  return rustTemplateResolver.renderTemplate("src/lib.rs.tpl", {
    projectName: config.name,
  });
}

/**
 * Generate test module
 */
export async function generateTestModule(): Promise<string> {
  return `// Tests module
pub mod integration;

#[cfg(test)]
mod tests {
    // Common test utilities
}
`;
}

/**
 * Generate integration tests
 */
export async function generateIntegrationTests(config: ProjectConfig): Promise<string> {
  const projectName = config.name.replace(/-/g, "_");
  return `//! Integration tests for ${config.name}

use ${projectName}::create_app;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn test_health_check() {
    let app = create_app().await;

    let response = app
        .oneshot(Request::builder().uri("/health").body(String::new()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
`;
}

/**
 * Generate justfile
 */
export async function generateJustfile(config: ProjectConfig): Promise<string> {
  return rustTemplateResolver.renderTemplate("justfile.tpl", {
    projectName: config.name,
    hasDatabase: config.database ? true : false,
    dbDriverFeature: config.database === "postgres" ? "postgres" : "sqlite",
  });
}

/**
 * Generate GitHub Actions workflow
 */
export async function generateGitHubActions(config: BuildConfig): Promise<string> {
  return rustTemplateResolver.renderTemplate("github-actions.tpl", {
    ...config,
  });
}

/**
 * Generate Cargo config
 */
export async function generateCargoConfig(_config: BuildConfig): Promise<string> {
  return `# Cargo configuration
[build]
# Use LLD linker for faster builds on Linux
# target-dir = "target"

[alias]
r = "run"
b = "build"
t = "test"
c = "check"
cl = "clippy"

[net]
git-fetch-with-cli = true

[registries.crates-io]
protocol = "sparse"
`;
}
