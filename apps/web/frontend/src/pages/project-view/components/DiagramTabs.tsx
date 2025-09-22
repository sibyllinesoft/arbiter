/**
 * DiagramTabs - Right pane tabs for diagrams and handlers
 */

import React from 'react';
import {
  ArchitectureReport,
  FlowReport,
  FsmReport,
  GapsReport,
  HandlersReport,
  ResolvedReport,
  SiteReport,
  ViewReport,
} from '../../../components/index';
import type { Project } from '../../../types/api';
import { DiagramPlaceholder } from './DiagramPlaceholder';

interface DiagramTabsProps {
  project: Project | null;
}

export function useDiagramTabs({ project }: DiagramTabsProps) {
  const diagramTabs = [
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

  return diagramTabs;
}
