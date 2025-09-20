import React, { useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Providers
import { QueryProvider } from './providers/QueryProvider';
import {
  ProjectProvider,
  useCurrentProject,
  useSetCurrentProject,
} from './contexts/ProjectContext';

// Stores
import { useUiStore, useTabs } from './stores/ui-store';

// Hooks
import { useProjects } from './hooks/api-hooks';
import { useWebSocket } from './hooks/useWebSocket';

// Components
import TopBar from './components/Layout/TopBar';
import SplitPane from './components/Layout/SplitPane';
import Tabs from './components/Layout/Tabs';
import {
  FlowDiagram,
  FriendlyDiagram,
  SourceDiagram,
  FsmDiagram,
  ViewDiagram,
  SiteDiagram,
  GapsChecklist,
  ResolvedViewer,
  ArchitectureDiagram,
} from './components/diagrams';
import { Handlers } from './components/Handlers';

import type { DiagramTab, LeftTab, RightTab } from './types/ui';

// Main app content with modern state management
function AppContent() {
  // Store state
  const { leftTab, rightTab, setLeftTab, setRightTab } = useTabs();
  const currentProject = useCurrentProject();
  const setCurrentProject = useSetCurrentProject();

  // Server state
  const { data: projects } = useProjects();

  // Initialize WebSocket connection
  useWebSocket(currentProject?.id || null, {
    autoReconnect: true,
    showToastNotifications: true,
  });

  // Initialize first project if available
  useEffect(() => {
    if (!currentProject && projects && projects.length > 0) {
      setCurrentProject(projects[0]);
      console.log('Set initial project:', projects[0]);
    }
  }, [currentProject, projects, setCurrentProject]);

  const diagramTabs = [
    {
      id: 'flow',
      label: 'Flow',
      content: currentProject ? (
        <FlowDiagram projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="Flow Diagram" />
      ),
    },
    {
      id: 'site',
      label: 'Site',
      content: currentProject ? (
        <SiteDiagram projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="Site DAG" />
      ),
    },
    {
      id: 'fsm',
      label: 'FSM',
      content: currentProject ? (
        <FsmDiagram projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="FSM Diagram" />
      ),
    },
    {
      id: 'view',
      label: 'View',
      content: currentProject ? (
        <ViewDiagram projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="View Wireframes" />
      ),
    },
    {
      id: 'gaps',
      label: 'Gaps',
      content: currentProject ? (
        <GapsChecklist projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="Gaps Checklist" />
      ),
    },
    {
      id: 'resolved',
      label: 'Resolved',
      content: currentProject ? (
        <ResolvedViewer projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="Resolved JSON" />
      ),
    },
    {
      id: 'architecture',
      label: 'Architecture',
      content: currentProject ? (
        <ArchitectureDiagram projectId={currentProject.id} />
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

  const editorTabs = [
    {
      id: 'source',
      label: 'Source',
      content: currentProject ? (
        <SourceDiagram projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="Source Code" />
      ),
    },
    {
      id: 'friendly',
      label: 'Friendly',
      content: currentProject ? (
        <FriendlyDiagram projectId={currentProject.id} />
      ) : (
        <DiagramPlaceholder type="Friendly Diagram" />
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
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

// Placeholder component for diagrams
function DiagramPlaceholder({ type }: { type: string }) {
  return (
    <div className="diagram-container">
      <div className="diagram-loading">
        <div className="text-center">
          <div className="spinner h-8 w-8 mb-4 mx-auto"></div>
          <p>{type} coming soon...</p>
          <p className="text-sm text-gray-400 mt-2">
            This will render interactive diagrams from the backend IR
          </p>
        </div>
      </div>
    </div>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p className="text-gray-600 mb-4">The application encountered an unexpected error.</p>
          <details className="text-left">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
              Error Details
            </summary>
            <pre className="mt-2">{this.state.error?.stack}</pre>
          </details>
          <button
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App component with all providers
function App() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <ProjectProvider>
          <AppContent />
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </ProjectProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

export default App;
