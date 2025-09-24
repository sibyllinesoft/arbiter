/**
 * ProjectView - Detailed project interface with diagrams and editor
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Stores
import { useTabs } from '../../stores/ui-store';

// Contexts
import { useSetCurrentProject } from '../../contexts/ProjectContext';

// Hooks
import { useAppSettings } from '../../contexts/AppContext';
import { useProject } from '../../hooks/api-hooks';
import { useWebSocket } from '../../hooks/useWebSocket';

import SplitPane from '../../components/Layout/SplitPane';
import Tabs from '../../components/Layout/Tabs';
// Components
import TopBar from '../../components/Layout/TopBar';
import { ProjectHeader, useDiagramTabs, useEditorTabs } from './components';

import type { LeftTab, RightTab } from '../../types/ui';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const setCurrentProject = useSetCurrentProject();
  const { data: project, isLoading } = useProject(projectId || '');
  const { leftTab, rightTab, setLeftTab, setRightTab } = useTabs();
  const { settings } = useAppSettings();

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project, setCurrentProject]);

  const onNavigateBack = () => navigate('/');

  // Initialize WebSocket connection for this project
  useWebSocket(project?.id || null, {
    autoReconnect: true,
    showToastNotifications: settings.showNotifications,
  });

  if (isLoading) {
    return <div className="h-full flex items-center justify-center">Loading project...</div>;
  }

  if (!project) {
    return <div className="h-full flex items-center justify-center">Project not found</div>;
  }

  // Get tab configurations
  const diagramTabs = useDiagramTabs({ project });
  const editorTabs = useEditorTabs({ project });

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with back button */}
      <ProjectHeader project={project} onNavigateBack={onNavigateBack} />

      {/* Top navigation bar */}
      <TopBar className="flex-shrink-0" />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <SplitPane defaultSize="40%" minSize="300px" maxSize="70%" split="vertical">
          {/* Left pane - Editor with tabs (Source & Friendly) */}
          <div className="h-full bg-white border-r border-gray-200">
            <Tabs
              activeTab={leftTab}
              onTabChange={tab => setLeftTab(tab as LeftTab)}
              tabs={editorTabs}
              className="h-full"
            />
          </div>

          {/* Right pane - Diagrams */}
          <div className="h-full bg-white">
            <Tabs
              activeTab={rightTab}
              onTabChange={tab => setRightTab(tab as RightTab)}
              tabs={diagramTabs}
              className="h-full"
            />
          </div>
        </SplitPane>
      </div>
    </div>
  );
}
