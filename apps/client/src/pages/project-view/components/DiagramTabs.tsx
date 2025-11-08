/**
 * DiagramTabs - Right pane tabs for diagrams and activity
 */

import { ArchitectureReport, EventsReport, ServicesReport, TasksReport } from "@/components/index";
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
  ];

  return diagramTabs;
}
