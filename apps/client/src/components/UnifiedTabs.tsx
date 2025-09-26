/**
 * UnifiedTabs - Combines editor and diagram tabs into a single tab list
 */

import React from 'react';
import type { Project } from '../types/api';
import {
  ArchitectureReport,
  FlowReport,
  FriendlyEditor,
  FsmReport,
  GapsReport,
  HandlersReport,
  ResolvedReport,
  SiteReport,
  SourceEditor,
  ViewReport,
} from './';

interface DiagramPlaceholderProps {
  type: string;
}

function DiagramPlaceholder({ type }: DiagramPlaceholderProps) {
  return (
    <div className="flex h-full items-center justify-center bg-white transition-colors dark:bg-graphite-950">
      <div className="text-center text-gray-600 dark:text-graphite-300">
        <div className="mb-3 text-gray-400 dark:text-graphite-400">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-gray-100 shadow-sm dark:bg-graphite-900">
            <span className="text-2xl">📊</span>
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
}

export function useUnifiedTabs({ project }: UnifiedTabsProps) {
  const allTabs = [
    // Editor tabs
    {
      id: 'source',
      label: 'Source',
      content: project ? (
        <SourceEditor projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Source Code" />
      ),
    },
    {
      id: 'friendly',
      label: 'Friendly',
      content: project ? (
        <FriendlyEditor projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Friendly Diagram" />
      ),
    },
    // Diagram tabs
    {
      id: 'flow',
      label: 'Flow',
      content: project ? (
        <FlowReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Flow Diagram" />
      ),
    },
    {
      id: 'site',
      label: 'Site',
      content: project ? (
        <SiteReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Site DAG" />
      ),
    },
    {
      id: 'fsm',
      label: 'FSM',
      content: project ? (
        <FsmReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="FSM Diagram" />
      ),
    },
    {
      id: 'view',
      label: 'View',
      content: project ? (
        <ViewReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="View Wireframes" />
      ),
    },
    {
      id: 'gaps',
      label: 'Gaps',
      content: project ? (
        <GapsReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Gaps Checklist" />
      ),
    },
    {
      id: 'resolved',
      label: 'Resolved',
      content: project ? (
        <ResolvedReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Resolved JSON" />
      ),
    },
    {
      id: 'architecture',
      label: 'Sources',
      content: project ? (
        <ArchitectureReport projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="System Architecture" />
      ),
    },
    {
      id: 'handlers',
      label: 'Handlers',
      content: <HandlersReport />,
    },
  ];

  return allTabs;
}
