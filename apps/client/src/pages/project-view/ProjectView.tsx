/**
 * ProjectView - Detailed project interface with diagrams and editor
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// Stores
import { useTabs } from "@/stores/ui-store";

// Contexts
import { useSetCurrentProject } from "@/contexts/ProjectContext";

// Hooks
import { useAppSettings } from "@/contexts/AppContext";
import { useProject } from "@/hooks/api-hooks";
import { useWebSocket } from "@/hooks/useWebSocket";

import SplitPane from "@/components/Layout/SplitPane";
import Tabs from "@/components/Layout/Tabs";
import TopBar from "@/components/Layout/TopBar";
// Components
import { SourceEditor } from "@/components/index";
import { TabBadgeProvider } from "@/contexts/TabBadgeContext";
import { Braces } from "lucide-react";
import { ProjectHeader, useDiagramTabs } from "./components";

import type { RightTab } from "@/types/ui";

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const setCurrentProject = useSetCurrentProject();
  const { data: project, isLoading, isError } = useProject(projectId || "");
  const [tabBadges, setTabBadges] = useState<Record<string, number>>({});
  const { rightTab, setRightTab } = useTabs();
  const { settings } = useAppSettings();

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project, setCurrentProject]);

  const onNavigateBack = () => navigate("/");

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
      navigate("/", { replace: true });
    }
  }, [isError, isLoading, navigate, project, projectId, setCurrentProject]);

  const handleTabBadgeUpdate = useCallback((tabId: string, count: number | null) => {
    setTabBadges((previous) => {
      if (count == null) {
        if (!(tabId in previous)) {
          return previous;
        }
        const { [tabId]: _removed, ...rest } = previous;
        return rest;
      }
      if (previous[tabId] === count) {
        return previous;
      }
      return { ...previous, [tabId]: count };
    });
  }, []);

  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center bg-white text-gray-700 transition-colors dark:bg-graphite-950 dark:text-graphite-200">
        Loading project...
      </div>
    );
  }

  // Get tab configurations
  const diagramTabs = useDiagramTabs({ project, tabBadges });

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-graphite-950">
      {/* Header with back button */}
      <ProjectHeader project={project} onNavigateBack={onNavigateBack} />

      {/* Top navigation bar */}
      <TopBar className="flex-shrink-0" />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <TabBadgeProvider value={handleTabBadgeUpdate}>
          <SplitPane defaultSize="40%" minSize="300px" maxSize="70%" split="vertical">
            {/* Left pane - Editor tabs */}
            <div className="h-full flex flex-col border-r border-gray-200 bg-gray-50 dark:border-graphite-700 dark:bg-graphite-950">
              <div className="border-b border-gray-200 bg-white px-6 py-6 dark:border-graphite-800 dark:bg-graphite-900">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm dark:bg-blue-900/30 dark:text-blue-200">
                    <Braces className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                      Source Editor
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-graphite-300">
                      Review and edit project artifacts with multi-file navigation and change
                      tracking.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-hidden px-6 py-6">
                <div className="h-full rounded-xl border border-gray-200 bg-white/70 shadow-sm dark:border-graphite-700 dark:bg-graphite-900/40">
                  <SourceEditor projectId={project.id} />
                </div>
              </div>
            </div>

            {/* Right pane - Diagrams */}
            <div className="h-full bg-white dark:bg-graphite-950">
              <Tabs
                activeTab={rightTab}
                onTabChange={(tab) => setRightTab(tab as RightTab)}
                tabs={diagramTabs}
                className="h-full"
              />
            </div>
          </SplitPane>
        </TabBadgeProvider>
      </div>
    </div>
  );
}
