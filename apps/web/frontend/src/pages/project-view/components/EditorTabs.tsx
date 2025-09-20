/**
 * EditorTabs - Left pane tabs for source and friendly editor
 */

import React from 'react';
import { FriendlyDiagram, SourceDiagram } from '../../../components/diagrams';
import { DiagramPlaceholder } from './DiagramPlaceholder';
import type { Project } from '../../../types/api';

interface EditorTabsProps {
  project: Project | null;
}

export function useEditorTabs({ project }: EditorTabsProps) {
  const editorTabs = [
    {
      id: 'source',
      label: 'Source',
      content: project ? (
        <SourceDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Source Code" />
      ),
    },
    {
      id: 'friendly',
      label: 'Friendly',
      content: project ? (
        <FriendlyDiagram projectId={project.id} />
      ) : (
        <DiagramPlaceholder type="Friendly Diagram" />
      ),
    },
  ];

  return editorTabs;
}
