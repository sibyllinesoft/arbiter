/**
 * DiagramTabs - Right pane tabs for diagrams and activity
 */

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
      ...(typeof serviceCount === "number" ? { badge: serviceCount } : {}),
      content: project ? (
        <ServicesReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Service Catalog" />
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
