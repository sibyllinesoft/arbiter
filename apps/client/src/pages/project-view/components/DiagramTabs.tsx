/**
 * DiagramTabs - Right pane tabs for diagrams and handlers
 */

import {
  ArchitectureReport,
  EventsReport,
  HandlersReport,
  ServicesReport,
  TasksReport,
  WebhooksReport,
} from "@/components/index";
import type { Project } from "@/types/api";
import { DiagramPlaceholder } from "./DiagramPlaceholder";

interface DiagramTabsProps {
  project: Project | null;
}

export function useDiagramTabs({ project }: DiagramTabsProps) {
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
      id: "services",
      label: "Services",
      content: project ? (
        <ServicesReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Service Catalog" />
      ),
    },
    {
      id: "tasks",
      label: "Tasks",
      content: project ? (
        <TasksReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Epic Tasks" />
      ),
    },
    {
      id: "events",
      label: "Events",
      content: project ? (
        <EventsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Event Log" />
      ),
    },
    {
      id: "webhooks",
      label: "Webhooks",
      content: project ? (
        <WebhooksReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Webhook Configuration" />
      ),
    },
    {
      id: "handlers",
      label: "Handlers",
      content: <HandlersReport />,
    },
  ];

  return diagramTabs;
}
