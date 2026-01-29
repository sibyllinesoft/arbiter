/**
 * Data-driven configuration for the architecture diagram ribbon/palette.
 *
 * This configuration defines all available entity types, their icons, and how
 * they appear in the ribbon. Customize this file or extend it via plugins to
 * add new entity types or modify existing ones.
 */

import {
  AppWindow,
  Box,
  Cloud,
  Container,
  Cpu,
  Database,
  Eye,
  FolderTree,
  Globe,
  HardDrive,
  Laptop,
  Layers,
  MessageSquare,
  Monitor,
  Route,
  Server,
  Shield,
  Smartphone,
  TabletSmartphone,
  Terminal,
  User,
  Workflow,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================================
// Type Definitions
// ============================================================================

/** Single entity type configuration */
export interface EntityTypeConfig {
  id: string;
  label: string;
  entityType: string;
  icon: LucideIcon;
  /** Optional subtype for classification */
  subtype?: string;
  /** Optional description shown in tooltips */
  description?: string;
}

/** Dropdown group configuration */
export interface DropdownConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  items: EntityTypeConfig[];
}

/** Button (single-click action) configuration */
export interface ButtonConfig extends EntityTypeConfig {}

/** Context-specific ribbon configuration */
export interface RibbonContextConfig {
  /** Single-click buttons shown directly in ribbon */
  buttons: ButtonConfig[];
  /** Dropdown groups */
  dropdowns: DropdownConfig[];
}

// ============================================================================
// Cloud Providers
// ============================================================================

export const CLOUD_PROVIDERS: EntityTypeConfig[] = [
  { id: "aws", label: "AWS", entityType: "cloud-aws", icon: Cloud },
  { id: "gcp", label: "GCP", entityType: "cloud-gcp", icon: Cloud },
  { id: "azure", label: "Azure", entityType: "cloud-azure", icon: Cloud },
  { id: "cloudflare", label: "Cloudflare", entityType: "cloud-cloudflare", icon: Cloud },
  { id: "vercel", label: "Vercel", entityType: "cloud-vercel", icon: Cloud },
  { id: "custom", label: "Custom Cloud", entityType: "cloud-custom", icon: Globe },
];

// ============================================================================
// Frontend Types
// ============================================================================

export const FRONTEND_TYPES: EntityTypeConfig[] = [
  {
    id: "web",
    label: "Web App",
    entityType: "frontend",
    subtype: "web",
    icon: Globe,
    description: "Browser-based web application",
  },
  {
    id: "react-native",
    label: "React Native",
    entityType: "frontend",
    subtype: "react-native",
    icon: TabletSmartphone,
    description: "Cross-platform mobile app",
  },
  {
    id: "android",
    label: "Android",
    entityType: "frontend",
    subtype: "android",
    icon: Smartphone,
    description: "Native Android application",
  },
  {
    id: "ios",
    label: "iOS",
    entityType: "frontend",
    subtype: "ios",
    icon: Smartphone,
    description: "Native iOS application",
  },
  {
    id: "electron",
    label: "Electron",
    entityType: "frontend",
    subtype: "electron",
    icon: Laptop,
    description: "Desktop application",
  },
  {
    id: "native",
    label: "Native Desktop",
    entityType: "frontend",
    subtype: "native",
    icon: AppWindow,
    description: "Native desktop application",
  },
];

// ============================================================================
// Service Types
// ============================================================================

export const SERVICE_TYPES: EntityTypeConfig[] = [
  {
    id: "api",
    label: "REST API",
    entityType: "service",
    subtype: "rest-api",
    icon: Zap,
    description: "RESTful API service",
  },
  {
    id: "graphql",
    label: "GraphQL",
    entityType: "service",
    subtype: "graphql",
    icon: Layers,
    description: "GraphQL API service",
  },
  {
    id: "grpc",
    label: "gRPC",
    entityType: "service",
    subtype: "grpc",
    icon: Zap,
    description: "gRPC service",
  },
  {
    id: "websocket",
    label: "WebSocket",
    entityType: "service",
    subtype: "websocket",
    icon: Zap,
    description: "Real-time WebSocket service",
  },
  {
    id: "worker",
    label: "Background Worker",
    entityType: "worker",
    icon: Workflow,
    description: "Background job processor",
  },
  {
    id: "cron",
    label: "Scheduled Job",
    entityType: "service",
    subtype: "cron",
    icon: Workflow,
    description: "Scheduled/cron job",
  },
  {
    id: "microservice",
    label: "Microservice",
    entityType: "service",
    subtype: "microservice",
    icon: Server,
    description: "Generic microservice",
  },
];

// ============================================================================
// Data Store Types
// ============================================================================

export const DATA_STORE_TYPES: EntityTypeConfig[] = [
  {
    id: "postgres",
    label: "PostgreSQL",
    entityType: "database",
    subtype: "postgresql",
    icon: Database,
  },
  { id: "mysql", label: "MySQL", entityType: "database", subtype: "mysql", icon: Database },
  { id: "mongodb", label: "MongoDB", entityType: "database", subtype: "mongodb", icon: Database },
  { id: "redis", label: "Redis", entityType: "cache", subtype: "redis", icon: HardDrive },
  {
    id: "memcached",
    label: "Memcached",
    entityType: "cache",
    subtype: "memcached",
    icon: HardDrive,
  },
  {
    id: "rabbitmq",
    label: "RabbitMQ",
    entityType: "queue",
    subtype: "rabbitmq",
    icon: MessageSquare,
  },
  { id: "kafka", label: "Kafka", entityType: "queue", subtype: "kafka", icon: MessageSquare },
  { id: "sqs", label: "AWS SQS", entityType: "queue", subtype: "sqs", icon: MessageSquare },
  {
    id: "s3",
    label: "S3 / Object Storage",
    entityType: "storage",
    subtype: "s3",
    icon: FolderTree,
  },
];

// ============================================================================
// Infrastructure Types
// ============================================================================

export const INFRASTRUCTURE_TYPES: EntityTypeConfig[] = [
  { id: "kubernetes", label: "Kubernetes", entityType: "kubernetes", icon: Container },
  {
    id: "docker",
    label: "Docker",
    entityType: "infrastructure",
    subtype: "docker",
    icon: Container,
  },
  {
    id: "lambda",
    label: "Serverless Function",
    entityType: "infrastructure",
    subtype: "lambda",
    icon: Zap,
  },
  { id: "cdn", label: "CDN", entityType: "infrastructure", subtype: "cdn", icon: Globe },
  {
    id: "load-balancer",
    label: "Load Balancer",
    entityType: "infrastructure",
    subtype: "load-balancer",
    icon: Layers,
  },
  {
    id: "api-gateway",
    label: "API Gateway",
    entityType: "infrastructure",
    subtype: "api-gateway",
    icon: Shield,
  },
];

// ============================================================================
// CLI/Tool Types
// ============================================================================

export const CLI_TYPES: EntityTypeConfig[] = [
  { id: "cli", label: "CLI Tool", entityType: "cli", icon: Terminal },
  { id: "sdk", label: "SDK / Library", entityType: "package", subtype: "sdk", icon: Box },
];

// ============================================================================
// Module-Level Types (inside containers)
// ============================================================================

export const UI_MODULE_TYPES: EntityTypeConfig[] = [
  { id: "view", label: "View / Page", entityType: "view", icon: Eye },
  { id: "component", label: "Component", entityType: "component", icon: Box },
  { id: "route", label: "Route", entityType: "route", icon: Route },
];

export const API_MODULE_TYPES: EntityTypeConfig[] = [
  { id: "endpoint", label: "Endpoint", entityType: "endpoint", icon: Route },
  { id: "handler", label: "Handler", entityType: "component", subtype: "handler", icon: Zap },
  {
    id: "middleware",
    label: "Middleware",
    entityType: "component",
    subtype: "middleware",
    icon: Layers,
  },
];

export const DATA_MODULE_TYPES: EntityTypeConfig[] = [
  { id: "table", label: "Table", entityType: "component", subtype: "table", icon: FolderTree },
  {
    id: "collection",
    label: "Collection",
    entityType: "component",
    subtype: "collection",
    icon: Database,
  },
  { id: "schema", label: "Schema", entityType: "component", subtype: "schema", icon: FolderTree },
];

// ============================================================================
// Ribbon Context Configurations
// ============================================================================

/** Top-level canvas (nothing selected) */
export const CANVAS_RIBBON: RibbonContextConfig = {
  buttons: [
    { id: "actor", label: "Actor", entityType: "actor", icon: User },
    { id: "system", label: "System", entityType: "system", icon: Box },
  ],
  dropdowns: [{ id: "clouds", label: "Clouds", icon: Cloud, items: CLOUD_PROVIDERS }],
};

/** Inside a system or cloud (container level) */
export const SYSTEM_RIBBON: RibbonContextConfig = {
  buttons: [],
  dropdowns: [
    { id: "frontends", label: "Frontends", icon: Monitor, items: FRONTEND_TYPES },
    { id: "services", label: "Services", icon: Server, items: SERVICE_TYPES },
    { id: "data", label: "Data Stores", icon: Database, items: DATA_STORE_TYPES },
    { id: "infra", label: "Infrastructure", icon: Cpu, items: INFRASTRUCTURE_TYPES },
    { id: "tools", label: "Tools", icon: Terminal, items: CLI_TYPES },
  ],
};

/** Inside a frontend container */
export const FRONTEND_RIBBON: RibbonContextConfig = {
  buttons: [],
  dropdowns: [{ id: "ui", label: "UI Elements", icon: Eye, items: UI_MODULE_TYPES }],
};

/** Inside a service/API container */
export const SERVICE_RIBBON: RibbonContextConfig = {
  buttons: [],
  dropdowns: [{ id: "api", label: "API Elements", icon: Route, items: API_MODULE_TYPES }],
};

/** Inside a database container */
export const DATABASE_RIBBON: RibbonContextConfig = {
  buttons: [],
  dropdowns: [
    { id: "schema", label: "Schema Elements", icon: FolderTree, items: DATA_MODULE_TYPES },
  ],
};

// ============================================================================
// Context Resolution
// ============================================================================

/**
 * Get the appropriate ribbon configuration for a selected entity.
 * Returns canvas config if nothing is selected.
 */
export function getRibbonConfigForEntity(selectedType: string | null): RibbonContextConfig {
  if (!selectedType) {
    return CANVAS_RIBBON;
  }

  const type = selectedType.toLowerCase();

  // System-level containers
  if (type === "system" || type.includes("cloud")) {
    return SYSTEM_RIBBON;
  }

  // Frontend containers
  if (
    type.includes("frontend") ||
    type.includes("mobile") ||
    type.includes("web") ||
    type.includes("android") ||
    type.includes("ios") ||
    type.includes("electron")
  ) {
    return FRONTEND_RIBBON;
  }

  // Service/API containers
  if (
    type.includes("service") ||
    type.includes("api") ||
    type.includes("worker") ||
    type.includes("graphql") ||
    type.includes("grpc")
  ) {
    return SERVICE_RIBBON;
  }

  // Database containers
  if (
    type.includes("database") ||
    type.includes("db") ||
    type.includes("cache") ||
    type.includes("queue") ||
    type.includes("storage")
  ) {
    return DATABASE_RIBBON;
  }

  // Actor - no children allowed
  if (type === "actor") {
    return { buttons: [], dropdowns: [] };
  }

  // Default to system ribbon for unknown container types
  return SYSTEM_RIBBON;
}

// ============================================================================
// Plugin/Extension Support
// ============================================================================

/**
 * Registry for custom entity types added by plugins.
 * Plugins can call registerEntityType() to add their own types.
 */
const customEntityTypes: Map<string, EntityTypeConfig> = new Map();
const customDropdowns: Map<string, DropdownConfig> = new Map();

/** Register a custom entity type */
export function registerEntityType(config: EntityTypeConfig): void {
  customEntityTypes.set(config.id, config);
}

/** Register a custom dropdown */
export function registerDropdown(config: DropdownConfig): void {
  customDropdowns.set(config.id, config);
}

/** Get all registered custom entity types */
export function getCustomEntityTypes(): EntityTypeConfig[] {
  return Array.from(customEntityTypes.values());
}

/** Get all registered custom dropdowns */
export function getCustomDropdowns(): DropdownConfig[] {
  return Array.from(customDropdowns.values());
}
