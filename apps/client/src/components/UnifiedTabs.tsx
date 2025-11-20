/**
 * UnifiedTabs - Combines editor and diagram tabs into a single tab list
 */

import React from "react";
import type { Project } from "../types/api";
import { ArchitectureReport, ClientsReport, EventsReport, ServicesReport, TasksReport } from "./";

interface DiagramPlaceholderProps {
  type: string;
}

function DiagramPlaceholder({ type }: DiagramPlaceholderProps) {
  return (
    <div className="flex h-full items-center justify-center bg-white transition-colors dark:bg-graphite-950">
      <div className="text-center text-gray-600 dark:text-graphite-300">
        <div className="mb-3 text-gray-400 dark:text-graphite-400">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 shadow-sm dark:bg-graphite-900">
            <span className="text-2xl font-semibold text-gray-400 dark:text-graphite-500">...</span>
          </div>
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-graphite-50">{type}</h3>
        <p>Select a project to view this content</p>
      </div>
    </div>
  );
}

interface UnifiedTabsProps {
  project: Project | null;
  tabBadges?: Record<string, number>;
}

export function useUnifiedTabs({ project, tabBadges }: UnifiedTabsProps) {
  const serviceCount = tabBadges?.services ?? project?.entities?.services;
  const clientCount = tabBadges?.clients ?? project?.entities?.frontends;
  const taskCount = tabBadges?.tasks;
  const eventCount = tabBadges?.events;

  const allTabs = [
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
      id: "clients",
      label: "Clients",
      ...(typeof clientCount === "number" ? { badge: clientCount } : {}),
      content: project ? (
        <ClientsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Client Catalog" />
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

  return allTabs;
}
