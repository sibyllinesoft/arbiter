/**
 * ProjectView - Detailed project interface with diagrams and editor
 */

import React from 'react';

// Stores
import { useTabs } from '../../stores/ui-store';

// Hooks
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAppSettings } from '../../contexts/AppContext';

// Components
import TopBar from '../../components/Layout/TopBar';
import SplitPane from '../../components/Layout/SplitPane';
import Tabs from '../../components/Layout/Tabs';
import { ProjectHeader, useDiagramTabs, useEditorTabs } from './components';

import type { LeftTab, RightTab } from '../../types/ui';
import type { Project } from '../../types/api';

interface ProjectViewProps {
  project: Project;
  onNavigateBack: () => void;
}

export function ProjectView({ project, onNavigateBack }: ProjectViewProps) {
  // Store state
  const { leftTab, rightTab, setLeftTab, setRightTab } = useTabs();
  const { settings } = useAppSettings();

  // Initialize WebSocket connection for this project
  useWebSocket(project?.id || null, {
    autoReconnect: true,
    showToastNotifications: settings.showNotifications,
  });

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
