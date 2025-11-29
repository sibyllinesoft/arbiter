import {
  ArtifactCard,
  type ArtifactCardMetaRow,
  type ArtifactCardProps,
} from "@/components/ArtifactCard";
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
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const countLabel = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const asRecord = (value: unknown): ComponentMetadata | undefined =>
  value && typeof value === "object" ? (value as ComponentMetadata) : undefined;

const buildModuleMetaRows = (data: DiagramComponentData): ArtifactCardMetaRow[] => {
  const metadata: ComponentMetadata = data.metadata ?? {};
  const rows: ArtifactCardMetaRow[] = [];
  const moduleType = safeText(metadata["moduleType"]) || safeText(metadata["kind"]);
  const owner = safeText(metadata["owner"]);

  if (moduleType) {
    rows.push({
      key: "moduleType",
      icon: <Layers className="w-3.5 h-3.5" />,
      content: friendlyCase(moduleType),
    });
  }

  if (owner) {
    rows.push({
      key: "moduleOwner",
      icon: <Users className="w-3.5 h-3.5" />,
      content: owner,
    });
  }

  if (moduleType === "capability") {
    const capabilityKind = safeText(metadata["kind"]);
    if (capabilityKind) {
      rows.push({
        key: "capabilityKind",
        icon: <Shield className="w-3.5 h-3.5" />,
        content: friendlyCase(capabilityKind),
      });
    }
  }

  if (moduleType === "flow" && Array.isArray(metadata["steps"])) {
    rows.push({
      key: "flowSteps",
      icon: <ListChecks className="w-3.5 h-3.5" />,
      content: countLabel((metadata["steps"] as unknown[]).length, "step"),
    });
  }

  if (moduleType === "data-schema") {
    const schema = asRecord(metadata["schema"]);
    const tables = Array.isArray(schema?.["tables"])
      ? (schema?.["tables"] as unknown[]).length
      : null;
    const engine = safeText(schema?.["engine"]);
    rows.push({
      key: "schemaEngine",
      icon: <Database className="w-3.5 h-3.5" />,
      content: [
        engine ? friendlyCase(engine) : "Schema",
        tables ? `• ${countLabel(tables, "table")}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (moduleType === "documentation") {
    const api = asRecord(metadata["api"]);
    const format = safeText(api?.["format"]);
    const version = safeText(api?.["version"]);
    rows.push({
      key: "apiDocs",
      icon: <BookOpenCheck className="w-3.5 h-3.5" />,
      content: [format ? friendlyCase(format) : "Documentation", version ? `v${version}` : null]
        .filter(Boolean)
        .join(" "),
    });
  }

  if (moduleType === "runbook") {
    const runbook = asRecord(metadata["runbook"]);
    const path = safeText(runbook?.["path"]);
    rows.push({
      key: "runbookPath",
      icon: <FileText className="w-3.5 h-3.5" />,
      content: path ?? "Runbook",
    });
  }

  if (moduleType === "performance") {
    const config = asRecord(metadata["config"]);
    const sla = asRecord(config?.["sla"]);
    const uptime = safeText(sla?.["uptime"]);
    if (uptime) {
      rows.push({
        key: "performanceSla",
        icon: <Target className="w-3.5 h-3.5" />,
        content: `SLA ${uptime}`,
      });
    }
  }

  if (Array.isArray(metadata["deliverables"])) {
    rows.push({
      key: "moduleDeliverables",
      icon: <ListChecks className="w-3.5 h-3.5" />,
      content: countLabel((metadata["deliverables"] as unknown[]).length, "deliverable"),
    });
  }

  return rows;
};

const buildInfrastructureMetaRows = (data: DiagramComponentData): ArtifactCardMetaRow[] => {
  const metadata: ComponentMetadata = data.metadata ?? {};
  const rows: ArtifactCardMetaRow[] = [];
  const category = safeText(metadata["category"]);

  if (category) {
    rows.push({
      key: "infraCategory",
      icon: <Network className="w-3.5 h-3.5" />,
      content: friendlyCase(category),
    });
  }

  if (metadata["scope"]) {
    rows.push({
      key: "infraScope",
      icon: <Map className="w-3.5 h-3.5" />,
      content: friendlyCase(String(metadata["scope"])),
    });
  }

  if (category === "environment") {
    const environment = asRecord(metadata["environment"]);
    const domain = safeText(environment?.["domain"]);
    if (domain) {
      rows.push({
        key: "environmentDomain",
        icon: <Globe className="w-3.5 h-3.5" />,
        content: domain,
      });
    }

    const releaseGate = safeText(environment?.["releaseGate"]);
    if (releaseGate) {
      rows.push({
        key: "environmentGate",
        icon: <Shield className="w-3.5 h-3.5" />,
        content: friendlyCase(releaseGate),
      });
    }

    const secrets = Array.isArray(environment?.["secrets"])
      ? (environment?.["secrets"] as unknown[]).length
      : 0;
    if (secrets > 0) {
      rows.push({
        key: "environmentSecrets",
        icon: <FileText className="w-3.5 h-3.5" />,
        content: countLabel(secrets, "secret"),
      });
    }
  }

  if (category === "observability") {
    const config = asRecord(metadata["config"]);
    const logging = asRecord(config?.["logging"]);
    const monitoring = asRecord(config?.["monitoring"]);
    const loggingLevel = safeText(logging?.["level"]);
    const metricsProvider = safeText(monitoring?.["metricsProvider"]);

    if (loggingLevel) {
      rows.push({
        key: "observabilityLogging",
        icon: <Shield className="w-3.5 h-3.5" />,
        content: `Logs ${friendlyCase(loggingLevel)}`,
      });
    }

    if (metricsProvider) {
      rows.push({
        key: "observabilityMetrics",
        icon: <Target className="w-3.5 h-3.5" />,
        content: friendlyCase(metricsProvider),
      });
    }

    const alertCount = Array.isArray(monitoring?.["alerts"])
      ? (monitoring?.["alerts"] as unknown[]).length
      : 0;
    if (alertCount > 0) {
      rows.push({
        key: "observabilityAlerts",
        icon: <Clock4 className="w-3.5 h-3.5" />,
        content: countLabel(alertCount, "alert"),
      });
    }
  }

  if (category === "database-migration") {
    const config = asRecord(metadata["config"]);
    const tool = safeText(config?.["tool"]);
    const strategy = safeText(config?.["strategy"]);
    const schedule = safeText(config?.["schedule"]);

    if (tool) {
      rows.push({
        key: "migrationTool",
        icon: <Database className="w-3.5 h-3.5" />,
        content: friendlyCase(tool),
      });
    }

    if (strategy) {
      rows.push({
        key: "migrationStrategy",
        icon: <Layers className="w-3.5 h-3.5" />,
        content: friendlyCase(strategy),
      });
    }

    if (schedule) {
      rows.push({
        key: "migrationSchedule",
        icon: <Clock4 className="w-3.5 h-3.5" />,
        content: friendlyCase(schedule),
      });
    }
  }

  return rows;
};

const deriveMetaRows = (data: DiagramComponentData): ArtifactCardMetaRow[] => {
  const type = safeText(data?.type)?.toLowerCase();
  if (type === "package") {
    return buildModuleMetaRows(data);
  }
  if (type === "infrastructure") {
    return buildInfrastructureMetaRows(data);
  }
  return [];
};

export const ComponentCard: React.FC<ComponentCardProps> = ({ metaRows, data, ...rest }) => {
  const derivedRows = useMemo(() => deriveMetaRows(data), [data]);
  const rowsToUse = metaRows && metaRows.length > 0 ? metaRows : derivedRows;

  return <ArtifactCard data={data} metaRows={rowsToUse} {...rest} />;
};
