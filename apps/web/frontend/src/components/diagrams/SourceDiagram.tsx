import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Hash, FileText, Download, Clipboard } from 'lucide-react';
import { apiService } from '../../services/api';
import MonacoEditor from '../Editor/MonacoEditor';
import type { ResolvedSpecResponse } from '../../types/api';

interface SourceDiagramProps {
  /** Project ID to fetch resolved spec data */
  projectId: string;
  /** Additional CSS classes */
  className?: string;
  /** Optional title for the diagram */
  title?: string;
}

export const SourceDiagram: React.FC<SourceDiagramProps> = ({
  projectId,
  className = '',
  title = 'CUE Specification - Source View'
}) => {
  const [resolvedData, setResolvedData] = useState<Record<string, unknown> | null>(null);
  const [sourceContent, setSourceContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [specHash, setSpecHash] = useState<string>('');
  const [lastSync, setLastSync] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Convert resolved data back to CUE-like syntax for source display
  const convertToCueSource = (data: Record<string, unknown>): string => {
    const formatValue = (value: unknown, indent: number = 0): string => {
      const indentStr = '  '.repeat(indent);
      
      if (value === null || value === undefined) {
        return 'null';
      }
      
      if (typeof value === 'boolean' || typeof value === 'number') {
        return String(value);
      }
      
      if (typeof value === 'string') {
        // Handle multiline strings
        if (value.includes('\n')) {
          return `"""
${value}
${indentStr}"""`;
        }
        return `"${value}"`;
      }
      
      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        
        const items = value.map(item => `${indentStr}  ${formatValue(item, indent + 1)}`);
        return `[
${items.join(',\n')}
${indentStr}]`;
      }
      
      if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value);
        if (entries.length === 0) return '{}';
        
        const fields = entries.map(([key, val]) => {
          // Format key (quote if needed)
          const formattedKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `"${key}"`;
          return `${indentStr}  ${formattedKey}: ${formatValue(val, indent + 1)}`;
        });
        
        return `{
${fields.join('\n')}
${indentStr}}`;
      }
      
      return String(value);
    };

    // Generate CUE package structure
    let cueContent = '// CUE Specification\n';
    cueContent += '// This is a reconstructed view of the resolved specification\n\n';
    cueContent += 'package arbiter\n\n';

    // Add resolved data as CUE definitions
    const entries = Object.entries(data);
    
    for (const [key, value] of entries) {
      const formattedKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `"${key}"`;
      cueContent += `${formattedKey}: ${formatValue(value)}\n\n`;
    }

    return cueContent;
  };

  useEffect(() => {
    const fetchResolvedSpec = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: ResolvedSpecResponse = await apiService.getResolvedSpec(projectId);
        setResolvedData(response.resolved);
        setSpecHash(response.spec_hash);
        setLastSync(new Date().toISOString());
        
        // Convert resolved data to CUE source format
        const cueSource = convertToCueSource(response.resolved);
        setSourceContent(cueSource);
        
      } catch (err) {
        console.error('Failed to fetch resolved spec:', err);
        setError(err instanceof Error ? err.message : 'Failed to load specification data');
        setSourceContent('// Error loading specification data\n// Please check the console for details');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchResolvedSpec();
    }
  }, [projectId]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sourceContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([sourceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbiter-spec-${specHash.substring(0, 8)}.cue`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    if (projectId) {
      setLoading(true);
      // Re-trigger the useEffect by clearing and setting projectId
      const currentProjectId = projectId;
      setTimeout(() => {
        // This will trigger the useEffect to re-fetch data
        const fetchData = async () => {
          try {
            const response: ResolvedSpecResponse = await apiService.getResolvedSpec(currentProjectId);
            setResolvedData(response.resolved);
            setSpecHash(response.spec_hash);
            setLastSync(new Date().toISOString());
            const cueSource = convertToCueSource(response.resolved);
            setSourceContent(cueSource);
          } catch (err) {
            console.error('Failed to refresh spec:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh specification data');
          } finally {
            setLoading(false);
          }
        };
        fetchData();
      }, 100);
    }
  };

  if (loading) {
    return (
      <div className={`h-full flex flex-col ${className}`}>
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading specification source...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full flex flex-col ${className}`}>
        <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center bg-red-50">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div className="text-center">
              <div className="text-red-900 font-medium">Failed to load specification</div>
              <div className="text-red-700 text-sm mt-1">{error}</div>
              <button
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lineCount = sourceContent.split('\n').length;
  const charCount = sourceContent.length;

  return (
    <div className={`h-full flex flex-col min-h-0 ${className}`}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
              <span className="flex items-center space-x-1">
                <FileText className="w-3 h-3" />
                <span>{lineCount} lines, {charCount} chars</span>
              </span>
              {lastSync && (
                <span>synced {new Date(lastSync).toLocaleTimeString()}</span>
              )}
              {specHash && (
                <span className="flex items-center space-x-1">
                  <Hash className="w-3 h-3" />
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                    {specHash.substring(0, 8)}...
                  </code>
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleCopy}
              className={`px-3 py-1 text-sm rounded transition-colors flex items-center space-x-1 ${
                copySuccess 
                  ? 'text-green-700 bg-green-100' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Clipboard className="w-3 h-3" />
              <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MonacoEditor
          value={sourceContent}
          onChange={() => {}} // Read-only for now
          language="cue"
          theme="cue-light"
          options={{
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            minimap: { enabled: true },
            folding: true,
            bracketMatching: 'always',
            fontSize: 14,
            lineHeight: 1.6,
            fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", Consolas, monospace',
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            renderLineHighlight: 'gutter',
            readOnly: true, // Make read-only since this is a derived view
            contextmenu: true,
            selectOnLineNumbers: true,
          }}
        />
      </div>
    </div>
  );
};

export default SourceDiagram;