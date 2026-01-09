/**
 * DiagramTabs - Right pane tabs for diagrams and activity
 */

import { ServicesReport } from "@/components/ServicesReport";
import CapabilitiesReport from "@/components/api/CapabilitiesReport";
import FlowsReport from "@/components/api/FlowsReport";
import PackagesReport from "@/components/api/PackagesReport";
import SchemasReport from "@/components/api/SchemasReport";
import { TasksReport } from "@/components/api/TasksReport";
import ToolsReport from "@/components/api/ToolsReport";
import ArchitectureFlowReport from "@/components/core/ArchitectureFlowReport";
import { EventsReport } from "@/components/io/EventsReport";
import ContractsReport from "@/components/io/reports/ContractsReport";
import InfrastructureReport from "@/components/io/reports/InfrastructureReport";
import type { Project } from "@/types/api";
import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface DiagramTabsProps {
  project: Project | null;
  tabBadges?: Record<string, number>;
}

/** Tab definition for declarative tab configuration */
interface TabDefinition {
  id: string;
  label: string;
  placeholder: string;
  countKey: keyof NonNullable<Project["entities"]> | "tasks" | "events" | "schemas" | "contracts";
  ReportComponent: React.ComponentType<{ projectId: string }>;
}

/** Tab configuration for all diagram tabs */
const TAB_DEFINITIONS: TabDefinition[] = [
  {
    id: "architecture",
    label: "Architecture",
    placeholder: "System Architecture",
    countKey: "services",
    ReportComponent: ArchitectureFlowReport,
  },
  {
    id: "schemas",
    label: "Schemas",
    placeholder: "Data Schemas",
    countKey: "schemas",
    ReportComponent: SchemasReport,
  },
  {
    id: "contracts",
    label: "Contracts",
    placeholder: "API Contracts",
    countKey: "contracts",
    ReportComponent: ContractsReport,
  },
  {
    id: "services",
    label: "Services",
    placeholder: "Service Catalog",
    countKey: "services",
    ReportComponent: ServicesReport,
  },
  {
    id: "packages",
    label: "Packages",
    placeholder: "Packages",
    countKey: "packages",
    ReportComponent: PackagesReport,
  },
  {
    id: "tools",
    label: "Tools",
    placeholder: "Tools",
    countKey: "tools",
    ReportComponent: ToolsReport,
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    placeholder: "Infrastructure",
    countKey: "infrastructure",
    ReportComponent: InfrastructureReport,
  },
  {
    id: "flows",
    label: "Flows",
    placeholder: "Flows",
    countKey: "flows",
    ReportComponent: FlowsReport,
  },
  {
    id: "capabilities",
    label: "Capabilities",
    placeholder: "Capabilities",
    countKey: "capabilities",
    ReportComponent: CapabilitiesReport,
  },
  {
    id: "tasks",
    label: "Tasks",
    placeholder: "Group Tasks",
    countKey: "tasks",
    ReportComponent: TasksReport,
  },
  {
    id: "events",
    label: "Events",
    placeholder: "Event Log",
    countKey: "events",
    ReportComponent: EventsReport,
  },
];

export function useDiagramTabs({ project, tabBadges }: DiagramTabsProps) {
  // Prefer the canonical project entity counts (kept in sync via WebSocket + React Query)
  // so the Services tab chip matches the project list badge. Fall back to in-tab updates
  // only if the project entity counts are missing.
  const serviceCount = project?.entities?.services ?? tabBadges?.services;
  const taskCount = tabBadges?.tasks;
  const eventCount = tabBadges?.events;
  const schemaCount = tabBadges?.schemas;
  const contractCount = tabBadges?.contracts;
  const packageCount = tabBadges?.packages ?? project?.entities?.packages;
  const toolCount = tabBadges?.tools ?? project?.entities?.tools;
  const infrastructureCount = tabBadges?.infrastructure ?? project?.entities?.infrastructure;
  const flowCount = tabBadges?.flows ?? project?.entities?.flows;
  const capabilityCount = tabBadges?.capabilities ?? project?.entities?.capabilities;

  const diagramTabs = [
    {
      id: "architecture",
      label: "Architecture",
      content: project ? (
        <ArchitectureFlowReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="System Architecture" />
      ),
    },
    {
      id: "schemas",
      label: "Schemas",
      ...(typeof schemaCount === "number" ? { badge: schemaCount } : {}),
      content: project ? (
        <SchemasReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Data Schemas" />
      ),
    },
    {
      id: "contracts",
      label: "Contracts",
      ...(typeof contractCount === "number" ? { badge: contractCount } : {}),
      content: project ? (
        <ContractsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="API Contracts" />
      ),
    },
    {
      id: "services",
      label: "Services",
      ...(typeof serviceCount === "number" ? { badge: serviceCount } : {}),
      content: project ? (
        <ServicesReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Service Catalog" />
      ),
    },
    {
      id: "packages",
      label: "Packages",
      ...(typeof packageCount === "number" ? { badge: packageCount } : {}),
      content: project ? (
        <PackagesReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Packages" />
      ),
    },
    {
      id: "tools",
      label: "Tools",
      ...(typeof toolCount === "number" ? { badge: toolCount } : {}),
      content: project ? (
        <ToolsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Tools" />
      ),
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      ...(typeof infrastructureCount === "number" ? { badge: infrastructureCount } : {}),
      content: project ? (
        <InfrastructureReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Infrastructure" />
      ),
    },
    {
      id: "flows",
      label: "Flows",
      ...(typeof flowCount === "number" ? { badge: flowCount } : {}),
      content: project ? (
        <FlowsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Flows" />
      ),
    },
    {
      id: "capabilities",
      label: "Capabilities",
      ...(typeof capabilityCount === "number" ? { badge: capabilityCount } : {}),
      content: project ? (
        <CapabilitiesReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Capabilities" />
      ),
    },
    {
      id: "tasks",
      label: "Tasks",
      ...(typeof taskCount === "number" ? { badge: taskCount } : {}),
      content: project ? (
        <TasksReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Group Tasks" />
      ),
    },
    {
      id: "events",
      label: "Events",
      ...(typeof eventCount === "number" ? { badge: eventCount } : {}),
      content: project ? (
        <EventsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Event Log" />
      ),
    },
  ];

  return diagramTabs;
}
