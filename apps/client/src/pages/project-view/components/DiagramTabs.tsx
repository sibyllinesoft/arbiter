/**
 * DiagramTabs - Right pane tabs for diagrams and activity
 */

import CapabilitiesReport from "@/components/CapabilitiesReport";
import ContractsReport from "@/components/ContractsReport";
import FlowsReport from "@/components/FlowsReport";
import InfrastructureReport from "@/components/InfrastructureReport";
import PackagesReport from "@/components/PackagesReport";
import SchemasReport from "@/components/SchemasReport";
import ToolsReport from "@/components/ToolsReport";
import { ArchitectureReport, EventsReport, ServicesReport, TasksReport } from "@/components/index";
import type { Project } from "@/types/api";
import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface DiagramTabsProps {
  project: Project | null;
  tabBadges?: Record<string, number>;
}

export function useDiagramTabs({ project, tabBadges }: DiagramTabsProps) {
  const serviceCount = tabBadges?.services ?? project?.entities?.services;
  const taskCount = tabBadges?.tasks;
  const eventCount = tabBadges?.events;
  const schemaCount = tabBadges?.schemas;
  const contractCount = tabBadges?.contracts;
  const packageCount = tabBadges?.packages ?? project?.entities?.modules;
  const toolCount = tabBadges?.tools ?? project?.entities?.tools;
  const infrastructureCount = tabBadges?.infrastructure ?? project?.entities?.infrastructure;
  const flowCount = tabBadges?.flows ?? project?.entities?.flows;
  const capabilityCount = tabBadges?.capabilities ?? project?.entities?.capabilities;

  const diagramTabs = [
    {
      id: "architecture",
      label: "Sources",
      content: project ? (
        <ArchitectureReport projectId={project.id} />
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
        <DiagramPlaceholder type="Epic Tasks" />
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
