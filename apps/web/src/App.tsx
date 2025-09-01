import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import mermaid from 'mermaid';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { 
  analyzeRequestSchema,
  createProjectSchema,
  type AnalyzeRequest,
  type AnalysisResultSchema,
  type ProjectResponse,
} from '../../../packages/shared/dist/index.js';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});

interface CueError {
  message: string;
  line?: number;
  column?: number;
  filename?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'object' | 'array' | 'value';
  children?: string[];
}

const API_BASE = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

// Generate a random user ID and color for collaboration
const USER_ID = Math.random().toString(36).substr(2, 9);
const USER_COLOR = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;

function App() {
  const [currentProject, setCurrentProject] = useState<ProjectResponse | null>(null);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [cueText, setCueText] = useState('// Enter CUE configuration here\nname: "example"\nversion: "1.0.0"');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResultSchema | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errors, setErrors] = useState<CueError[]>([]);
  const [graph, setGraph] = useState<GraphNode[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoBindingRef = useRef<MonacoBinding | null>(null);
  const websocketProviderRef = useRef<WebsocketProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  
  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);
  
  // Set up Y.js collaboration when project changes
  useEffect(() => {
    if (currentProject && editorRef.current) {
      setupCollaboration(currentProject.id);
    }
    return () => {
      cleanupCollaboration();
    };
  }, [currentProject]);
  
  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };
  
  const createProject = async () => {
    const name = prompt('Project name:');
    if (!name) return;
    
    try {
      const body = createProjectSchema.parse({ name });
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.ok) {
        const project = await response.json();
        setProjects(prev => [project, ...prev]);
        setCurrentProject(project);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };
  
  const setupCollaboration = (projectId: string) => {
    // Clean up previous collaboration
    cleanupCollaboration();
    
    // Create Y.js document
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');
    ydocRef.current = ydoc;
    
    // Set up WebSocket provider
    const wsProvider = new WebsocketProvider(WS_URL, projectId, ydoc);
    websocketProviderRef.current = wsProvider;
    
    // Set up Monaco binding
    if (editorRef.current) {
      const binding = new MonacoBinding(
        ytext,
        editorRef.current.getModel()!,
        new Set([editorRef.current]),
        wsProvider.awareness
      );
      monacoBindingRef.current = binding;
    }
    
    // Set awareness info
    wsProvider.awareness.setLocalStateField('user', {
      name: `User ${USER_ID}`,
      color: USER_COLOR,
    });
  };
  
  const cleanupCollaboration = () => {
    monacoBindingRef.current?.destroy();
    websocketProviderRef.current?.destroy();
    ydocRef.current?.destroy();
    
    monacoBindingRef.current = null;
    websocketProviderRef.current = null;
    ydocRef.current = null;
  };
  
  const debouncedAnalyze = useCallback((text: string) => {
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }
    
    // Clear previous debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set new debounce timer
    const timer = setTimeout(() => {
      analyzeCue(text);
    }, 250);
    
    setDebounceTimer(timer);
  }, [abortController, debounceTimer]);
  
  const analyzeCue = async (text: string) => {
    if (!text.trim()) {
      setAnalysisResult(null);
      setErrors([]);
      setGraph([]);
      return;
    }
    
    setIsAnalyzing(true);
    const controller = new AbortController();
    setAbortController(controller);
    
    try {
      const requestId = Math.random().toString(36).substr(2, 9);
      const body: AnalyzeRequest = { text, requestId };
      
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-client-id': USER_ID,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      if (response.ok) {
        const result: AnalysisResultSchema = await response.json();
        setAnalysisResult(result);
        setErrors(result.errors);
        setGraph(result.graph || []);
        
        // Update Monaco markers for errors
        updateErrorMarkers(result.errors);
      } else {
        const errorData = await response.json();
        setErrors([{ message: errorData.error || 'Analysis failed' }]);
        setGraph([]);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Analysis error:', error);
        setErrors([{ message: error.message || 'Analysis failed' }]);
        setGraph([]);
      }
    } finally {
      setIsAnalyzing(false);
      setAbortController(null);
    }
  };
  
  const updateErrorMarkers = (errors: CueError[]) => {
    if (!editorRef.current) return;
    
    const markers = errors
      .filter(err => err.line && err.column)
      .map(err => ({
        startLineNumber: err.line!,
        startColumn: err.column!,
        endLineNumber: err.line!,
        endColumn: err.column! + 10, // Approximate error length
        message: err.message,
        severity: 8, // monaco.MarkerSeverity.Error
      }));
    
    const model = editorRef.current.getModel();
    if (model) {
      // @ts-ignore - Monaco types issue
      window.monaco?.editor.setModelMarkers(model, 'cue', markers);
    }
  };
  
  const generateMermaidDiagram = useMemo(() => {
    if (graph.length === 0) return '';
    
    if (graph.length > 200) {
      return `graph TD
        A[Large Configuration]
        A --> B[${graph.length} top-level keys]
        B --> C[Click 'Expand' to view details]
        style A fill:#f9f,stroke:#333,stroke-width:2px`;
    }
    
    let diagram = 'graph TD\n';
    
    for (const node of graph.slice(0, 20)) { // Limit to 20 nodes for readability
      const nodeId = node.id.replace(/[^a-zA-Z0-9]/g, '');
      const label = node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label;
      
      diagram += `  ${nodeId}[${label}]\n`;
      
      if (node.children) {
        for (const child of node.children.slice(0, 5)) {
          const childId = (node.id + '_' + child).replace(/[^a-zA-Z0-9]/g, '');
          const childLabel = child.length > 15 ? child.substring(0, 15) + '...' : child;
          diagram += `  ${childId}[${childLabel}]\n`;
          diagram += `  ${nodeId} --> ${childId}\n`;
        }
      }
      
      // Style by type
      if (node.type === 'object') {
        diagram += `  style ${nodeId} fill:#e1f5fe\n`;
      } else if (node.type === 'array') {
        diagram += `  style ${nodeId} fill:#f3e5f5\n`;
      } else {
        diagram += `  style ${nodeId} fill:#e8f5e8\n`;
      }
    }
    
    return diagram;
  }, [graph]);
  
  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Set up CUE language highlighting (basic JSON-like syntax for now)
    editor.getModel()?.onDidChangeContent(() => {
      const value = editor.getValue();
      setCueText(value);
      debouncedAnalyze(value);
    });
    
    // Initial analysis
    debouncedAnalyze(cueText);
  };
  
  const saveRevision = async () => {
    if (!currentProject) return;
    
    try {
      const response = await fetch(`${API_BASE}/projects/${currentProject.id}/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cueText }),
      });
      
      if (response.ok) {
        console.log('Revision saved');
      }
    } catch (error) {
      console.error('Failed to save revision:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Arbiter</h1>
            <div className="flex items-center space-x-2">
              <select
                value={currentProject?.id || ''}
                onChange={(e) => {
                  const project = projects.find(p => p.id === e.target.value);
                  setCurrentProject(project || null);
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="">Select project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <button
                onClick={createProject}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                New Project
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAnalyzing && (
              <div className="text-sm text-gray-500 flex items-center">
                <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full mr-2"></div>
                Analyzing...
              </div>
            )}
            <button
              onClick={saveRevision}
              disabled={!currentProject}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save (Ctrl+S)
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Editor Panel */}
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b px-4 py-2">
            <h2 className="text-sm font-medium text-gray-700">CUE Editor</h2>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="json" // Using JSON syntax highlighting for CUE
              value={cueText}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                tabSize: 2,
                wordWrap: 'on',
                lineNumbers: 'on',
                glyphMargin: true,
                folding: true,
                lineDecorationsWidth: 0,
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
              }}
              theme="light"
            />
          </div>
        </div>
        
        {/* Right Panel - Diagnostics & Visualization */}
        <div className="w-96 bg-white border-l flex flex-col">
          {/* Diagnostics */}
          <div className="border-b">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="text-sm font-medium text-gray-700">Diagnostics</h3>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {errors.length === 0 ? (
                <div className="p-4 text-sm text-green-600">
                  ✓ No errors found
                </div>
              ) : (
                <div className="divide-y">
                  {errors.map((error, index) => (
                    <div key={index} className="p-3 text-sm">
                      <div className="text-red-600 font-medium">{error.message}</div>
                      {error.line && (
                        <div className="text-gray-500 mt-1">
                          Line {error.line}{error.column && `, Column ${error.column}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Visualization */}
          <div className="flex-1 flex flex-col">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h3 className="text-sm font-medium text-gray-700">Configuration Graph</h3>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {graph.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">
                  No valid configuration to visualize
                </div>
              ) : (
                <div>
                  {generateMermaidDiagram && (
                    <div
                      id="mermaid-diagram"
                      key={generateMermaidDiagram} // Force re-render on change
                      dangerouslySetInnerHTML={{
                        __html: mermaid.render('graph', generateMermaidDiagram),
                      }}
                    />
                  )}
                  {graph.length > 20 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
                      <p className="text-blue-800">
                        Showing first 20 nodes. Full graph has {graph.length} nodes.
                      </p>
                      <button className="mt-2 text-blue-600 hover:text-blue-800 underline">
                        Expand to full view
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;