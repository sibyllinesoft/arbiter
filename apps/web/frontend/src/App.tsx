import React, { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AppProvider, useApp, useCurrentProject } from './contexts/AppContext';
import { useWebSocket } from './hooks/useWebSocket';
import { apiService } from './services/api';

import TopBar from './components/Layout/TopBar';
import SplitPane from './components/Layout/SplitPane';
import Tabs from './components/Layout/Tabs';
import EditorPane from './components/Editor/EditorPane';
import MonacoEditor from './components/Editor/MonacoEditor';
import { 
  FlowDiagram, 
  FriendlyDiagram,
  FsmDiagram, 
  ViewDiagram, 
  SiteDiagram, 
  GapsChecklist, 
  ResolvedViewer
} from './components/diagrams';

import type { DiagramTab } from './types/ui';

// Main app content with providers
function AppContent() {
  const { state, setProject, setActiveTab } = useApp();
  const currentProject = useCurrentProject();
  
  // Initialize WebSocket connection
  useWebSocket(currentProject?.id || null, {
    autoReconnect: true,
    showToastNotifications: true,
  });

  // Initialize auth token and load initial project
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Set development auth token (only if auth is required)
        apiService.setAuthToken('dev-token');
        
        // Load initial project
        const projects = await apiService.getProjects();
        console.log('Loaded projects:', projects);
        if (projects.length > 0) {
          setProject(projects[0]);
          console.log('Set initial project:', projects[0]);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    if (!currentProject) {
      initializeApp();
    }
  }, [currentProject, setProject]);

  const diagramTabs = [
    {
      id: 'flow',
      label: 'Flow',
      content: currentProject ? <FlowDiagram projectId={currentProject.id} /> : <DiagramPlaceholder type="Flow Diagram" />,
    },
    {
      id: 'site', 
      label: 'Site',
      content: currentProject ? <SiteDiagram projectId={currentProject.id} /> : <DiagramPlaceholder type="Site DAG" />,
    },
    {
      id: 'fsm',
      label: 'FSM', 
      content: currentProject ? <FsmDiagram projectId={currentProject.id} /> : <DiagramPlaceholder type="FSM Diagram" />,
    },
    {
      id: 'view',
      label: 'View',
      content: currentProject ? <ViewDiagram projectId={currentProject.id} /> : <DiagramPlaceholder type="View Wireframes" />,
    },
    {
      id: 'gaps',
      label: 'Gaps',
      content: currentProject ? <GapsChecklist projectId={currentProject.id} /> : <DiagramPlaceholder type="Gaps Checklist" />,
      badge: state.gaps ? 
        state.gaps.missing_capabilities.length + 
        state.gaps.orphaned_tokens.length + 
        state.gaps.coverage_gaps.length + 
        state.gaps.duplicates.length : undefined,
    },
    {
      id: 'resolved',
      label: 'Resolved',
      content: currentProject ? <ResolvedViewer projectId={currentProject.id} /> : <DiagramPlaceholder type="Resolved JSON" />,
    },
  ];

  // Simple source editor component without file tree
  const SimpleSourceEditor = () => {
    const [sourceContent, setSourceContent] = useState(`# CUE Specification
# Auto-loaded arbiter.assembly.cue

package arbiter

// Define your specification here
app: {
  name: "example-app"
  version: "1.0.0"
  
  components: {
    api: {
      type: "service"
      port: 8080
    }
    
    web: {
      type: "frontend"
      framework: "react"
    }
  }
}
`);

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Source editor header */}
        <div className="px-6 py-3 bg-gradient-to-r from-graphite-50 to-white border-b border-graphite-100 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded flex items-center justify-center bg-purple-100">
              <code className="text-purple-600 text-xs font-mono">CUE</code>
            </div>
            <span className="font-medium text-sm text-graphite-800">
              arbiter.assembly.cue
            </span>
          </div>
        </div>
        
        {/* Monaco Editor */}
        <div className="flex-1">
          <MonacoEditor
            value={sourceContent}
            onChange={setSourceContent}
            language="cue"
            theme="cue-light"
            options={{
              automaticLayout: true,
              wordWrap: 'on',
              lineNumbers: 'on',
              minimap: { enabled: true },
              folding: true,
              bracketMatching: 'always',
              autoIndent: 'advanced',
              formatOnType: true,
              formatOnPaste: true,
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", Consolas, monospace',
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              renderLineHighlight: 'gutter',
            }}
          />
        </div>
      </div>
    );
  };

  const editorTabs = [
    {
      id: 'source',
      label: 'Source',
      content: <SimpleSourceEditor />,
    },
    {
      id: 'friendly',
      label: 'Friendly',
      content: currentProject ? <FriendlyDiagram projectId={currentProject.id} /> : <DiagramPlaceholder type="Friendly Diagram" />,
    },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Top navigation bar */}
      <TopBar className="flex-shrink-0" />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <SplitPane
          defaultSize="40%"
          minSize="300px"
          maxSize="70%"
          split="vertical"
        >
          {/* Left pane - Editor with tabs (Source & Friendly) */}
          <div className="h-full bg-white border-r border-gray-200">
            <Tabs
              activeTab={['source', 'friendly'].includes(state.activeTab) ? state.activeTab : 'source'}
              onTabChange={(tab) => setActiveTab(tab as DiagramTab)}
              tabs={editorTabs}
              className="h-full"
            />
          </div>

          {/* Right pane - Diagrams */}
          <div className="h-full bg-white">
            <Tabs
              activeTab={!['source', 'friendly'].includes(state.activeTab) ? state.activeTab : 'flow'}
              onTabChange={(tab) => setActiveTab(tab as DiagramTab)}
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
          <p className="text-gray-600 mb-4">
            The application encountered an unexpected error.
          </p>
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

// Main App component with providers
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
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
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
