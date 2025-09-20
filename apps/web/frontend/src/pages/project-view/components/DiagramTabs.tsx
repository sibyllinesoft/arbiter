/**
 * DiagramTabs - Right pane tabs for diagrams and handlers
 */

import React from 'react';
import {
  FlowDiagram,
  SiteDiagram,
  FsmDiagram,
  ViewDiagram,
  GapsChecklist,
  ResolvedViewer,
  ArchitectureDiagram,
} from '../../../components/diagrams';
import { Handlers } from '../../../components/Handlers';
import { DiagramPlaceholder } from './DiagramPlaceholder';
import type { Project } from '../../../types/api';

interface DiagramTabsProps {
  project: Project | null;
}

export function useDiagramTabs({ project }: DiagramTabsProps) {
  const diagramTabs = [
    {
      id: 'flow',
      label: 'Flow',
      content: project ? (
        <FlowDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Flow Diagram" />
      ),
    },
    {
      id: 'site',
      label: 'Site',
      content: project ? (
        <SiteDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Site DAG" />
      ),
    },
    {
      id: 'fsm',
      label: 'FSM',
      content: project ? (
        <FsmDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="FSM Diagram" />
      ),
    },
    {
      id: 'view',
      label: 'View',
      content: project ? (
        <ViewDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="View Wireframes" />
      ),
    },
    {
      id: 'gaps',
      label: 'Gaps',
      content: project ? (
        <GapsChecklist projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Gaps Checklist" />
      ),
    },
    {
      id: 'resolved',
      label: 'Resolved',
      content: project ? (
        <ResolvedViewer projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Resolved JSON" />
      ),
    },
    {
      id: 'architecture',
      label: 'Architecture',
      content: project ? (
        <ArchitectureDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="System Architecture" />
      ),
    },
    {
      id: 'handlers',
      label: 'Handlers',
      content: <Handlers />,
    },
  ];

  return diagramTabs;
}
