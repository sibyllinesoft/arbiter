import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle, Hash } from 'lucide-react';
import { apiService } from '../../services/api';
import type { ResolvedSpecResponse } from '../../types/api';

interface FriendlyDiagramProps {
  /** Project ID to fetch resolved spec data */
  projectId: string;
  /** Additional CSS classes */
  className?: string;
  /** Optional title for the diagram */
  title?: string;
}

// Removed AccordionSection interface - using single Main card approach

export const FriendlyDiagram: React.FC<FriendlyDiagramProps> = ({
  projectId,
  className = '',
  title = 'CUE Specification - Friendly View'
}) => {
  const [resolvedData, setResolvedData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMainExpanded, setIsMainExpanded] = useState<boolean>(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [specHash, setSpecHash] = useState<string>('');

  useEffect(() => {
    const fetchResolvedSpec = async () => {
      try {
        setLoading(true);
        setError(null);
        const response: ResolvedSpecResponse = await apiService.getResolvedSpec(projectId);
        setResolvedData(response.resolved);
        setSpecHash(response.spec_hash);
      } catch (err) {
        console.error('Failed to fetch resolved spec:', err);
        setError(err instanceof Error ? err.message : 'Failed to load specification data');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      fetchResolvedSpec();
    }
  }, [projectId]);

  const toggleMain = () => {
    setIsMainExpanded(prev => !prev);
  };

  const toggleCard = (cardKey: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardKey)) {
        newSet.delete(cardKey);
      } else {
        newSet.add(cardKey);
      }
      return newSet;
    });
  };

  const renderValue = (value: unknown, level: number = 0, parentKey?: string): React.ReactNode => {
    if (value === null) {
      return <span className="text-gray-400 italic">null</span>;
    }
    
    if (value === undefined) {
      return <span className="text-gray-400 italic">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={`font-mono ${value ? 'text-green-600' : 'text-red-600'}`}>{String(value)}</span>;
    }

    if (typeof value === 'number') {
      return <span className="font-mono text-blue-600">{value}</span>;
    }

    if (typeof value === 'string') {
      return <span className="font-mono text-purple-600">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">[]</span>;
      }
      
      return (
        <div className="space-y-2">
          <span className="text-gray-600 text-sm font-medium">Array ({value.length} items)</span>
          <ul className="list-disc list-inside space-y-1 ml-4">
            {value.map((item, index) => (
              <li key={index} className="text-gray-700">
                {renderValue(item, level + 1, `${parentKey}[${index}]`)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return <span className="text-gray-400 italic">{}</span>;
      }

      return (
        <div className="space-y-2">
          <span className="text-gray-600 text-sm font-medium">Object ({entries.length} properties)</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {entries.map(([key, val]) => {
              // For simple values, render as label/value pairs
              if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' || val === null) {
                return (
                  <div key={key} className="flex flex-col space-y-1 p-2 bg-gray-50 rounded border">
                    <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      {key}
                    </span>
                    <div className="text-sm">
                      {renderValue(val, level + 1, `${parentKey ? parentKey + '.' : ''}${key}`)}
                    </div>
                  </div>
                );
              }
              
              // For complex values (objects, arrays), render as full-width nested cards
              return (
                <div key={key} className="col-span-full">
                  <div className={`border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors ${
                    level === 0 ? 'border-gray-200' : 'border-gray-300'
                  }`}>
                    <div className="flex items-start justify-between mb-2">
                      <h4 className={`font-semibold text-gray-800 ${
                        level === 0 ? 'text-base' : level === 1 ? 'text-sm' : 'text-xs'
                      }`}>
                        {key}
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        {Array.isArray(val) ? 'array' : typeof val}
                      </span>
                    </div>
                    <div className="ml-2">
                      {renderValue(val, level + 1, `${parentKey ? parentKey + '.' : ''}${key}`)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return <span className="font-mono text-gray-600">{String(value)}</span>;
  };

  const renderMainCard = (data: Record<string, unknown>) => {
    const entries = Object.entries(data);
    const hasContent = entries.length > 0;

    return (
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <button
          onClick={toggleMain}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
          disabled={!hasContent}
        >
          <div className="flex items-center space-x-3">
            {hasContent ? (
              isMainExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )
            ) : (
              <div className="w-5 h-5" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 text-left">
              Main
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">{entries.length} properties</span>
            {hasContent ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                empty
              </span>
            )}
          </div>
        </button>
        
        {isMainExpanded && hasContent && (
          <div className="border-t border-gray-200 p-4 bg-gray-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {entries.map(([key, value]) => {
                // For simple values, render as label/value pairs
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
                  return (
                    <div key={key} className="flex flex-col space-y-1 p-2 bg-gray-50 rounded border">
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        {key}
                      </span>
                      <div className="text-sm">
                        {renderValue(value, 1, key)}
                      </div>
                    </div>
                  );
                }
                
                // For complex values (objects, arrays), render as full-width nested cards
                const isCardExpanded = expandedCards.has(key);
                const hasContent = value !== null && value !== undefined &&
                  (typeof value !== 'object' ||
                   (Array.isArray(value) && value.length > 0) ||
                   (!Array.isArray(value) && Object.keys(value as object).length > 0));

                return (
                  <div key={key} className="col-span-full">
                    <div className="border rounded-lg bg-white shadow-sm border-gray-200">
                      <button
                        onClick={() => toggleCard(key)}
                        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg text-left"
                        disabled={!hasContent}
                      >
                        <div className="flex items-center space-x-3">
                          {hasContent ? (
                            isCardExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                          <h4 className="text-base font-semibold text-gray-800">
                            {key}
                          </h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            {Array.isArray(value) ? `array (${value.length})` : `object (${Object.keys(value as object).length})`}
                          </span>
                          {hasContent ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                              empty
                            </span>
                          )}
                        </div>
                      </button>
                      
                      {isCardExpanded && hasContent && (
                        <div className="border-t border-gray-200 p-3 bg-gray-50/50">
                          <div className="ml-2">
                            {renderValue(value, 1, key)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading specification data...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div className="text-center">
              <div className="text-red-900 font-medium">Failed to load specification</div>
              <div className="text-red-700 text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!resolvedData || Object.keys(resolvedData).length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <div className="text-center">
              <div className="text-yellow-900 font-medium">No specification data found</div>
              <div className="text-yellow-700 text-sm mt-1">
                The project may not have any CUE fragments or they may not be resolved yet.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalProperties = Object.keys(resolvedData).length;

  return (
    <div className={`h-full flex flex-col min-h-0 ${className}`}>
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
              <span>{totalProperties} properties</span>
              <span>{isMainExpanded ? 'expanded' : 'collapsed'}</span>
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
              onClick={() => {
                setIsMainExpanded(false);
                setExpandedCards(new Set());
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              Collapse All
            </button>
            <button
              onClick={() => {
                setIsMainExpanded(true);
                const complexKeys = Object.entries(resolvedData)
                  .filter(([, value]) => typeof value === 'object' && value !== null)
                  .map(([key]) => key);
                setExpandedCards(new Set(complexKeys));
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              Expand All
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-3">
          {renderMainCard(resolvedData)}
        </div>
      </div>
    </div>
  );
};

export default FriendlyDiagram;