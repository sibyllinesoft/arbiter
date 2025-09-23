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
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-center">
        <div className="text-gray-400 mb-2">
          <div className="w-16 h-16 mx-auto bg-gray-200 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📊</span>
          </div>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{type}</h3>
        <p className="text-gray-600">Select a project to view this content</p>
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
