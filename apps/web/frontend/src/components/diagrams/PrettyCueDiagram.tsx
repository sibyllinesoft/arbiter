import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle, Hash } from 'lucide-react';
import { apiService } from '../../services/api';
import type { ResolvedSpecResponse } from '../../types/api';

interface PrettyCueDiagramProps {
  /** Project ID to fetch resolved spec data */
  projectId: string;
  /** Additional CSS classes */
  className?: string;
  /** Optional title for the diagram */
  title?: string;
}

interface AccordionSection {
  key: string;
  label: string;
  value: unknown;
  isExpanded: boolean;
  level: number;
}

export const PrettyCueDiagram: React.FC<PrettyCueDiagramProps> = ({
  projectId,
  className = '',
  title = 'CUE Specification Overview',
}) => {
  const [resolvedData, setResolvedData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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

  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  const renderValue = (value: unknown, level: number = 0): React.ReactNode => {
    if (value === null) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (value === undefined) {
      return <span className="text-gray-400 italic">undefined</span>;
    }

    if (typeof value === 'boolean') {
      return (
        <span className={`font-mono ${value ? 'text-green-600' : 'text-red-600'}`}>
          {String(value)}
        </span>
      );
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
        <div className="space-y-1">
          <span className="text-gray-600 text-sm">Array ({value.length} items)</span>
          <div className="border-l-2 border-gray-200 pl-3 space-y-2">
            {value.map((item, index) => (
              <div key={index} className="flex items-start space-x-2">
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
                  [{index}]
                </span>
                <div className="flex-1">{renderValue(item, level + 1)}</div>
              </div>
            ))}
          </div>
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
          <span className="text-gray-600 text-sm">Object ({entries.length} properties)</span>
          <div className="border-l-2 border-gray-200 pl-3 space-y-3">
            {entries.map(([key, val]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-800">{key}</span>
                  <span className="text-gray-400">:</span>
                </div>
                <div className="ml-4">{renderValue(val, level + 1)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return <span className="font-mono text-gray-600">{String(value)}</span>;
  };

  const createAccordionSections = (data: Record<string, unknown>): AccordionSection[] => {
    return Object.entries(data).map(([key, value]) => ({
      key,
      label: key,
      value,
      isExpanded: expandedSections.has(key),
      level: 0,
    }));
  };

  const renderAccordionSection = (section: AccordionSection) => {
    const { key, label, value, isExpanded } = section;
    const hasContent =
      value !== null &&
      value !== undefined &&
      (typeof value !== 'object' ||
        (Array.isArray(value) && value.length > 0) ||
        (!Array.isArray(value) && Object.keys(value as object).length > 0));

    return (
      <div key={key} className="border border-gray-200 rounded-lg bg-white shadow-sm">
        <button
          onClick={() => toggleSection(key)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
          disabled={!hasContent}
        >
          <div className="flex items-center space-x-3">
            {hasContent ? (
              isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )
            ) : (
              <div className="w-5 h-5" />
            )}
            <h3 className="text-lg font-semibold text-gray-900 text-left">{label}</h3>
          </div>
          <div className="flex items-center space-x-2">
            {hasContent ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">empty</span>
            )}
          </div>
        </button>

        {isExpanded && hasContent && (
          <div className="border-t border-gray-200 p-4 bg-gray-50/50">
            <div className="space-y-3">{renderValue(value)}</div>
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

  const sections = createAccordionSections(resolvedData);
  const totalSections = sections.length;
  const expandedCount = expandedSections.size;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
            <span>{totalSections} sections</span>
            <span>{expandedCount} expanded</span>
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
            onClick={() => setExpandedSections(new Set())}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            disabled={expandedCount === 0}
          >
            Collapse All
          </button>
          <button
            onClick={() => setExpandedSections(new Set(sections.map(s => s.key)))}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            disabled={expandedCount === totalSections}
          >
            Expand All
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">{sections.map(section => renderAccordionSection(section))}</div>
    </div>
  );
};

export default PrettyCueDiagram;
