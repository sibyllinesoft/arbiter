/**
 * Parser constants for file detection and classification.
 * Contains patterns and lists for identifying project types, frameworks, and file categories.
 */

/** Known Docker Compose file names */
export const DOCKER_COMPOSE_FILES = new Set(["docker-compose.yml", "docker-compose.yaml"]);

/** Node.js package manifest file names */
export const PACKAGE_MANIFESTS = new Set(["package.json", "bunfig.toml"]);

/** File patterns indicating database-related configuration */
export const DATABASE_HINTS = [
  "schema.prisma",
  "schema.sql",
  "migration.sql",
  "docker-compose.db",
  "docker-compose.database",
];

/** Keywords that indicate Kubernetes YAML manifests */
export const KUBERNETES_KEYWORDS = [
  "deployment",
  "statefulset",
  "daemonset",
  "service",
  "configmap",
  "secret",
  "ingress",
  "namespace",
];

/** Pattern for detecting React Router usage */
export const ROUTE_HINT_PATTERN =
  /<Route\s|createBrowserRouter|createRoutesFromElements|react-router/;

/** Pattern for detecting TSOA controller files */
export const TSOA_ROUTE_PATTERN = /controller|route|api/i;

/** Node.js backend/web frameworks for service detection */
export const NODE_WEB_FRAMEWORKS = [
  "express",
  "fastify",
  "koa",
  "hapi",
  "nest",
  "adonis",
  "meteor",
  "sails",
  "loopback",
  "restify",
  "hono",
];

/** Node.js frontend frameworks for UI project detection */
export const NODE_FRONTEND_FRAMEWORKS = [
  "react",
  "react-dom",
  "next",
  "vue",
  "angular",
  "svelte",
  "solid-js",
  "preact",
  "nuxt",
  "gatsby",
];

/** Node.js CLI tool frameworks */
export const NODE_CLI_FRAMEWORKS = [
  "commander",
  "yargs",
  "inquirer",
  "oclif",
  "meow",
  "cac",
  "clipanion",
];

/** Dependencies indicating TypeScript usage */
export const TYPESCRIPT_SIGNALS = [
  "typescript",
  "ts-node",
  "ts-node-dev",
  "tsx",
  "tsup",
  "@swc/core",
];

/** Rust web/HTTP frameworks for service detection */
export const RUST_WEB_FRAMEWORKS = [
  "axum",
  "warp",
  "actix-web",
  "rocket",
  "tide",
  "gotham",
  "nickel",
  "hyper",
  "poem",
  "salvo",
  "tower-web",
];

/** Rust CLI argument parsing frameworks */
export const RUST_CLI_FRAMEWORKS = ["clap", "structopt", "argh", "gumdrop"];
