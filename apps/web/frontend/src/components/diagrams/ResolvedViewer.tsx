import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { ResolvedSpecResponse } from '../../types/api';

interface ResolvedViewerProps {
  projectId: string;
  className?: string;
}

const ResolvedViewer: React.FC<ResolvedViewerProps> = ({ projectId, className = '' }) => {
  const [resolvedData, setResolvedData] = useState<ResolvedSpecResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) return;

    const loadResolvedData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiService.getResolvedSpec(projectId);
        setResolvedData(response);
      } catch (err) {
        console.error('Failed to load resolved data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load resolved spec');
      } finally {
        setLoading(false);
      }
    };

    loadResolvedData();
  }, [projectId]);

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const expandAll = () => {
    if (!resolvedData?.resolved) return;
    const allPaths = getAllPaths(resolvedData.resolved);
    setExpandedPaths(new Set(allPaths));
  };

  const collapseAll = () => {
    setExpandedPaths(new Set());
  };

  const getAllPaths = (obj: any, prefix = ''): string[] => {
    const paths: string[] = [];

    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          paths.push(...getAllPaths(obj[key], path));
        }
      });
    }

    return paths;
  };

  const renderValue = (value: any, path: string, depth = 0): React.ReactNode => {
    if (value === null) {
      return <span className="text-red-500 italic">null</span>;
    }

    if (value === undefined) {
      return <span className="text-gray-400 italic">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-blue-600 font-medium">{value.toString()}</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-green-600 font-medium">{value}</span>;
    }

    if (typeof value === 'string') {
      // Highlight search term
      if (searchTerm && value.toLowerCase().includes(searchTerm.toLowerCase())) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const parts = value.split(regex);
        return (
          <span className="text-purple-600">
            "
            {parts.map((part, index) =>
              regex.test(part) ? (
                <mark key={index} className="bg-yellow-200 px-1 rounded">
                  {part}
                </mark>
              ) : (
                part
              )
            )}
            "
          </span>
        );
      }
      return <span className="text-purple-600">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-500">[]</span>;
      }

      const isExpanded = expandedPaths.has(path);

      return (
        <div>
          <button
            onClick={() => togglePath(path)}
            className="text-left hover:bg-gray-50 rounded px-1 -mx-1"
          >
            <span className="text-gray-600">
              [{value.length}] {isExpanded ? '▼' : '▶'}
            </span>
          </button>
          {isExpanded && (
            <div className="ml-4 border-l border-gray-200 pl-4 mt-1">
              {value.map((item, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-400 text-xs mr-2">[{index}]:</span>
                  {renderValue(item, `${path}[${index}]`, depth + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return <span className="text-gray-500">{'{}'}</span>;
      }

      const isExpanded = expandedPaths.has(path);

      return (
        <div>
          <button
            onClick={() => togglePath(path)}
            className="text-left hover:bg-gray-50 rounded px-1 -mx-1"
          >
            <span className="text-gray-600">
              {`{${keys.length}}`} {isExpanded ? '▼' : '▶'}
            </span>
          </button>
          {isExpanded && (
            <div className="ml-4 border-l border-gray-200 pl-4 mt-1">
              {keys.map(key => {
                const childPath = `${path}.${key}`;
                const shouldHighlight =
                  searchTerm && key.toLowerCase().includes(searchTerm.toLowerCase());

                return (
                  <div key={key} className="mb-2">
                    <span
                      className={`font-medium text-sm mr-2 ${shouldHighlight ? 'bg-yellow-200 px-1 rounded' : 'text-blue-800'}`}
                    >
                      "{key}":
                    </span>
                    {renderValue(value[key], childPath, depth + 1)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return <span className="text-gray-600">{String(value)}</span>;
  };

  const copyToClipboard = async () => {
    if (!resolvedData?.resolved) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(resolvedData.resolved, null, 2));
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const downloadJson = () => {
    if (!resolvedData?.resolved) return;

    const jsonString = JSON.stringify(resolvedData.resolved, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `resolved-spec-${resolvedData.spec_hash.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading resolved spec...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-700 font-medium">Error loading resolved spec</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!resolvedData) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <p>No resolved spec available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header with controls */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Resolved Specification</h3>
            <p className="text-sm text-gray-600">
              Hash:{' '}
              <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                {resolvedData.spec_hash}
              </code>
              <span className="ml-2">
                Updated: {new Date(resolvedData.last_updated).toLocaleString()}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              title="Copy JSON to clipboard"
            >
              <svg
                className="w-4 h-4 inline mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </button>
            <button
              onClick={downloadJson}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              title="Download JSON file"
            >
              <svg
                className="w-4 h-4 inline mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Download
            </button>
          </div>
        </div>

        {/* Search and expand controls */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search keys and values..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-2 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-2 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>

      {/* JSON viewer */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 p-4 font-mono text-sm">
          {renderValue(resolvedData.resolved, 'root')}
        </div>
      </div>
    </div>
  );
};

export default ResolvedViewer;
