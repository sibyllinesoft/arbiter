import {
  ArtifactCard,
  type ArtifactCardMetaRow,
  type ArtifactCardProps,
} from "@/components/core/ArtifactCard";
import {
  BookOpenCheck,
  Clock4,
  Database,
  FileText,
  Globe,
  Layers,
  ListChecks,
  Map,
  Network,
  Shield,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useMemo } from "react";

export type ComponentCardProps = ArtifactCardProps;

type ComponentMetadata = Record<string, unknown>;

type DiagramComponentData = {
  type?: string;
  metadata?: ComponentMetadata;
} & Record<string, unknown>;

const friendlyCase = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const safeText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const countLabel = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const asRecord = (value: unknown): ComponentMetadata | undefined =>
  value && typeof value === "object" ? (value as ComponentMetadata) : undefined;

const getArrayLength = (value: unknown): number => (Array.isArray(value) ? value.length : 0);

/** Create a meta row with icon */
const createRow = (key: string, Icon: LucideIcon, content: string): ArtifactCardMetaRow => ({
  key,
  icon: <Icon className="w-3.5 h-3.5" />,
  content,
});

/** Add a simple text row if value exists */
const addTextRow = (
  rows: ArtifactCardMetaRow[],
  key: string,
  Icon: LucideIcon,
  value: string | undefined,
  transform: (v: string) => string = friendlyCase,
): void => {
  if (value) rows.push(createRow(key, Icon, transform(value)));
};

/** Add a count row if count > 0 */
const addCountRow = (
  rows: ArtifactCardMetaRow[],
  key: string,
  Icon: LucideIcon,
  arr: unknown,
  noun: string,
): void => {
  const count = getArrayLength(arr);
  if (count > 0) rows.push(createRow(key, Icon, countLabel(count, noun)));
};

/** Build module type-specific rows */
const buildModuleTypeRows = (
  rows: ArtifactCardMetaRow[],
  moduleType: string,
  metadata: ComponentMetadata,
): void => {
  switch (moduleType) {
    case "capability":
      addTextRow(rows, "capabilityKind", Shield, safeText(metadata["kind"]));
      break;
    case "flow":
      addCountRow(rows, "flowSteps", ListChecks, metadata["steps"], "step");
      break;
    case "data-schema": {
      const schema = asRecord(metadata["schema"]);
      const tables = getArrayLength(schema?.["tables"]);
      const engine = safeText(schema?.["engine"]);
      const content = [
        engine ? friendlyCase(engine) : "Schema",
        tables > 0 ? `• ${countLabel(tables, "table")}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      rows.push(createRow("schemaEngine", Database, content));
      break;
    }
    case "documentation": {
      const api = asRecord(metadata["api"]);
      const format = safeText(api?.["format"]);
      const version = safeText(api?.["version"]);
      const content = [
        format ? friendlyCase(format) : "Documentation",
        version ? `v${version}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      rows.push(createRow("apiDocs", BookOpenCheck, content));
      break;
    }
    case "runbook": {
      const runbook = asRecord(metadata["runbook"]);
      rows.push(createRow("runbookPath", FileText, safeText(runbook?.["path"]) ?? "Runbook"));
      break;
    }
    case "performance": {
      const config = asRecord(metadata["config"]);
      const sla = asRecord(config?.["sla"]);
      const uptime = safeText(sla?.["uptime"]);
      if (uptime) rows.push(createRow("performanceSla", Target, `SLA ${uptime}`));
      break;
    }
  }
};

const buildModuleMetaRows = (data: DiagramComponentData): ArtifactCardMetaRow[] => {
  const metadata: ComponentMetadata = data.metadata ?? {};
  const rows: ArtifactCardMetaRow[] = [];
  const moduleType = safeText(metadata["moduleType"]) || safeText(metadata["kind"]);

  addTextRow(rows, "moduleType", Layers, moduleType);
  addTextRow(rows, "moduleOwner", Users, safeText(metadata["owner"]), (v) => v);

  if (moduleType) buildModuleTypeRows(rows, moduleType, metadata);
  addCountRow(rows, "moduleDeliverables", ListChecks, metadata["deliverables"], "deliverable");

  return rows;
};

/** Add environment category rows */
const addEnvironmentRows = (rows: ArtifactCardMetaRow[], metadata: ComponentMetadata): void => {
  const environment = asRecord(metadata["environment"]);
  addTextRow(rows, "environmentDomain", Globe, safeText(environment?.["domain"]), (v) => v);
  addTextRow(rows, "environmentGate", Shield, safeText(environment?.["releaseGate"]));
  addCountRow(rows, "environmentSecrets", FileText, environment?.["secrets"], "secret");
};

/** Add observability category rows */
const addObservabilityRows = (rows: ArtifactCardMetaRow[], metadata: ComponentMetadata): void => {
  const config = asRecord(metadata["config"]);
  const logging = asRecord(config?.["logging"]);
  const monitoring = asRecord(config?.["monitoring"]);
  const loggingLevel = safeText(logging?.["level"]);
  const metricsProvider = safeText(monitoring?.["metricsProvider"]);

  if (loggingLevel)
    rows.push(createRow("observabilityLogging", Shield, `Logs ${friendlyCase(loggingLevel)}`));
  addTextRow(rows, "observabilityMetrics", Target, metricsProvider);
  addCountRow(rows, "observabilityAlerts", Clock4, monitoring?.["alerts"], "alert");
};

/** Add database migration category rows */
const addMigrationRows = (rows: ArtifactCardMetaRow[], metadata: ComponentMetadata): void => {
  const config = asRecord(metadata["config"]);
  addTextRow(rows, "migrationTool", Database, safeText(config?.["tool"]));
  addTextRow(rows, "migrationStrategy", Layers, safeText(config?.["strategy"]));
  addTextRow(rows, "migrationSchedule", Clock4, safeText(config?.["schedule"]));
};

/** Infrastructure category handlers */
const INFRA_CATEGORY_HANDLERS: Record<
  string,
  (rows: ArtifactCardMetaRow[], metadata: ComponentMetadata) => void
> = {
  environment: addEnvironmentRows,
  observability: addObservabilityRows,
  "database-migration": addMigrationRows,
};

const buildInfrastructureMetaRows = (data: DiagramComponentData): ArtifactCardMetaRow[] => {
  const metadata: ComponentMetadata = data.metadata ?? {};
  const rows: ArtifactCardMetaRow[] = [];
  const category = safeText(metadata["category"]);

  addTextRow(rows, "infraCategory", Network, category);
  if (metadata["scope"]) {
    rows.push(createRow("infraScope", Map, friendlyCase(String(metadata["scope"]))));
  }

  if (category) {
    const handler = INFRA_CATEGORY_HANDLERS[category];
    if (handler) handler(rows, metadata);
  }

  return rows;
};

/** Type-to-builder lookup */
const TYPE_BUILDERS: Record<string, (data: DiagramComponentData) => ArtifactCardMetaRow[]> = {
  package: buildModuleMetaRows,
  infrastructure: buildInfrastructureMetaRows,
};

const deriveMetaRows = (data: DiagramComponentData): ArtifactCardMetaRow[] => {
  const type = safeText(data?.type)?.toLowerCase();
  const builder = type ? TYPE_BUILDERS[type] : undefined;
  return builder ? builder(data) : [];
};

export const ComponentCard: React.FC<ComponentCardProps> = ({ metaRows, data, ...rest }) => {
  const derivedRows = useMemo(() => deriveMetaRows(data), [data]);
  const rowsToUse = metaRows && metaRows.length > 0 ? metaRows : derivedRows;

  return <ArtifactCard data={data} metaRows={rowsToUse} {...rest} />;
};
