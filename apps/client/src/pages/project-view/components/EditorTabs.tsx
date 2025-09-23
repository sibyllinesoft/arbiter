/**
 * EditorTabs - Left pane tabs for source and friendly editor
 */

import React from 'react';
import { FriendlyEditor, SourceEditor } from '../../../components/index';
import type { Project } from '../../../types/api';
import { DiagramPlaceholder } from './DiagramPlaceholder';

interface EditorTabsProps {
  project: Project | null;
}

export function useEditorTabs({ project }: EditorTabsProps) {
  const editorTabs = [
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
  ];

  return editorTabs;
}
