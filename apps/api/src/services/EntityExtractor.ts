/** Entity types that can be tracked in the system */
type TrackedEntityType =
  | "service"
  | "client"
  | "package"
  | "tool"
  | "group"
  | "endpoint"
  | "view"
  | "actor"
  | "capability"
  | "operation"
  | "flow"
  | "task"
  | "schema"
  | "database"
  | "process"
  | "issue"
  | "comment"
  | "route";

/**
 * Extracted entity data ready for database sync
 */
export interface ExtractedEntity {
  /** UUID identifier from CUE spec entityId field (required - client must provide) */
  id: string;
  /** Entity type */
  type: TrackedEntityType;
  /** Key/slug in the spec */
  slug: string;
  /** Full path in resolved spec (e.g., "services.invoiceService") */
  path: string;
  /** Human-readable name */
  name: string;
  /** Entity description */
  description: string | null;
  /** Full entity data */
  data: Record<string, unknown>;
}

/**
 * Map of spec paths to entity types
 */
const ENTITY_COLLECTION_MAP: Record<string, TrackedEntityType> = {
  services: "service",
  clients: "client",
  packages: "package",
  tools: "tool",
  groups: "group",
  capabilities: "capability",
  operations: "operation",
  behaviors: "flow",
  processes: "process",
  issues: "issue",
  comments: "comment",
};

/**
 * Extract a single entity from parsed data
 * Returns null if entity has no entityId (client must provide UUIDs)
 */
function extractEntity(
  data: Record<string, unknown>,
  type: TrackedEntityType,
  path: string,
  defaultSlug?: string,
): ExtractedEntity | null {
  // Get entityId from the data - this is required (client must provide)
  const entityId = data.entityId as string | undefined;
  if (!entityId) {
    return null; // Skip entities without UUIDs
  }

  const slug = defaultSlug || (data.id as string) || path.split(".").pop() || "";
  const name = (data.name as string) || slug;

  return {
    id: entityId,
    type,
    slug,
    path,
    name,
    description: (data.description as string) ?? null,
    data: { ...data },
  };
}

/**
 * Extract nested endpoints from services
 * Only extracts endpoints that have an entityId
 */
function extractEndpointsFromServices(
  services: Record<string, unknown>,
  entities: ExtractedEntity[],
): void {
  for (const [serviceSlug, service] of Object.entries(services)) {
    if (!service || typeof service !== "object") continue;
    const svc = service as Record<string, unknown>;
    const endpoints = svc.endpoints as Record<string, unknown> | undefined;
    if (!endpoints) continue;

    for (const [endpointSlug, endpoint] of Object.entries(endpoints)) {
      if (!endpoint || typeof endpoint !== "object") continue;
      const ep = endpoint as Record<string, unknown>;
      const entityId = ep.entityId as string | undefined;
      if (!entityId) continue; // Skip endpoints without UUIDs

      entities.push({
        id: entityId,
        type: "endpoint",
        slug: `${serviceSlug}.${endpointSlug}`,
        path: `services.${serviceSlug}.endpoints.${endpointSlug}`,
        name: (ep.name as string) || endpointSlug,
        description: (ep.description as string) ?? null,
        data: { ...ep, _parentService: serviceSlug },
      });
    }
  }
}

/**
 * Extract routes from UI section
 * Only extracts routes that have an entityId
 */
function extractRoutesFromUI(ui: Record<string, unknown>, entities: ExtractedEntity[]): void {
  const routes = ui.routes as unknown[] | undefined;
  if (!routes || !Array.isArray(routes)) return;

  routes.forEach((route, index) => {
    if (!route || typeof route !== "object") return;
    const r = route as Record<string, unknown>;
    const entityId = r.entityId as string | undefined;
    if (!entityId) return; // Skip routes without UUIDs

    // Routes can have an id field (RouteID like "invoices:list")
    const routeId = (r.id as string) || `route-${index}`;

    entities.push({
      id: entityId,
      type: "route",
      slug: routeId,
      path: `ui.routes[${index}]`,
      name: (r.name as string) || (r.path as string) || `Route ${index}`,
      description: (r.description as string) ?? null,
      data: { ...r },
    });
  });
}

/**
 * Extract schemas from components section
 * Only extracts schemas that have an entityId
 */
function extractSchemasFromComponents(
  components: Record<string, unknown>,
  entities: ExtractedEntity[],
): void {
  const schemas = components.schemas as Record<string, unknown> | undefined;
  if (!schemas) return;

  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (!schema || typeof schema !== "object") continue;
    const s = schema as Record<string, unknown>;
    const entityId = s.entityId as string | undefined;
    if (!entityId) continue; // Skip schemas without UUIDs

    entities.push({
      id: entityId,
      type: "schema",
      slug: schemaName,
      path: `components.schemas.${schemaName}`,
      name: (s.name as string) || schemaName,
      description: (s.description as string) ?? null,
      data: { ...s },
    });
  }
}

/**
 * Extract all entities from a resolved CUE specification
 */
export function extractEntitiesFromSpec(resolved: Record<string, unknown>): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Extract top-level entity collections
  for (const [collectionKey, entityType] of Object.entries(ENTITY_COLLECTION_MAP)) {
    const collection = resolved[collectionKey];
    if (!collection || typeof collection !== "object") continue;

    if (Array.isArray(collection)) {
      // Handle array collections (behaviors/flows)
      collection.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const data = item as Record<string, unknown>;
        // For flows, use the id field as the slug
        const slug = (data.id as string) || `${collectionKey}-${index}`;
        const entity = extractEntity(data, entityType, `${collectionKey}[${index}]`, slug);
        if (entity) entities.push(entity);
      });
    } else {
      // Handle object collections (services, clients, etc.)
      for (const [slug, value] of Object.entries(collection as Record<string, unknown>)) {
        if (!value || typeof value !== "object") continue;
        const entity = extractEntity(
          value as Record<string, unknown>,
          entityType,
          `${collectionKey}.${slug}`,
          slug,
        );
        if (entity) entities.push(entity);
      }
    }
  }

  // Extract nested entities
  const services = resolved.services as Record<string, unknown> | undefined;
  if (services) {
    extractEndpointsFromServices(services, entities);
  }

  const ui = resolved.ui as Record<string, unknown> | undefined;
  if (ui) {
    extractRoutesFromUI(ui, entities);
  }

  const components = resolved.components as Record<string, unknown> | undefined;
  if (components) {
    extractSchemasFromComponents(components, entities);
  }

  return entities;
}

// Note: No ID generation - clients must provide entityId in their CUE specs.
// Entities without entityId are skipped during extraction.
