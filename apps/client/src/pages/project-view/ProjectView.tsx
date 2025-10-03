/**
 * ProjectView - Detailed project interface with diagrams and editor
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Stores
import { useTabs } from '@/stores/ui-store';

// Contexts
import { useSetCurrentProject } from '@/contexts/ProjectContext';

// Hooks
import { useAppSettings } from '@/contexts/AppContext';
import { useProject } from '@/hooks/api-hooks';
import { useWebSocket } from '@/hooks/useWebSocket';

import SplitPane from '@/components/Layout/SplitPane';
import Tabs from '@/components/Layout/Tabs';
// Components
import TopBar from '@/components/Layout/TopBar';
import { ProjectHeader, useDiagramTabs, useEditorTabs } from './components';

import type { LeftTab, RightTab } from '@/types/ui';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const setCurrentProject = useSetCurrentProject();
  const { data: project, isLoading, isError } = useProject(projectId || '');
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

  useEffect(() => {
    if (!projectId) return;
    if (isLoading) return;

    if (isError || !project) {
      setCurrentProject(null);
      navigate('/', { replace: true });
    }
  }, [isError, isLoading, navigate, project, projectId, setCurrentProject]);

  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200">
        Loading project...
      </div>
    );
  }

  // Get tab configurations
  const diagramTabs = useDiagramTabs({ project });
  const editorTabs = useEditorTabs({ project });

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-graphite-950">
      {/* Header with back button */}
      <ProjectHeader project={project} onNavigateBack={onNavigateBack} />

      {/* Top navigation bar */}
      <TopBar className="flex-shrink-0" />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <SplitPane defaultSize="40%" minSize="300px" maxSize="70%" split="vertical">
          {/* Left pane - Editor tabs */}
          <div className="h-full bg-white dark:bg-graphite-950 border-r border-gray-200 dark:border-graphite-700">
            <Tabs
              activeTab={leftTab}
              onTabChange={tab => setLeftTab(tab as LeftTab)}
              tabs={editorTabs}
              className="h-full"
            />
          </div>

          {/* Right pane - Diagrams */}
          <div className="h-full bg-white dark:bg-graphite-950">
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
