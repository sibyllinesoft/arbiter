/**
 * EditorTabs - Left pane tabs for source editor
 */

import { SourceEditor } from '@/components/index';
import type { Project } from '@/types/api';
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
  ];

  return editorTabs;
}
