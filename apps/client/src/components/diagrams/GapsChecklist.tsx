import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';
import type { GapSet } from '../../types/api';

interface GapsChecklistProps {
  projectId: string;
  className?: string;
}

interface GapWithSeverity {
  type: string;
  message: string;
  location?: string;
  severity: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
}

const GapsChecklist: React.FC<GapsChecklistProps> = ({ projectId, className = '' }) => {
  const [gapData, setGapData] = useState<GapSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['high']));

  useEffect(() => {
    if (!projectId) return;

    const loadGapData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiService.getGaps(projectId);
        setGapData(response);
      } catch (err) {
        console.error('Failed to load gap data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load gaps');
      } finally {
        setLoading(false);
      }
    };

    loadGapData();
  }, [projectId]);

  const getGapSeverity = (gapType: string): 'high' | 'medium' | 'low' => {
    switch (gapType) {
      case 'missing_capabilities':
        return 'high';
      case 'orphaned_tokens':
        return 'medium';
      case 'coverage_gaps':
        return 'medium';
      case 'duplicates':
        return 'low';
      default:
        return 'low';
    }
  };

  const getGapIcon = (severity: 'high' | 'medium' | 'low'): React.ReactNode => {
    switch (severity) {
      case 'high':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'low':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const processGaps = (gaps: GapSet): Record<string, GapWithSeverity[]> => {
    const processedGaps: Record<string, GapWithSeverity[]> = {
      high: [],
      medium: [],
      low: [],
    };

    // Process missing capabilities
    gaps.missing_capabilities?.forEach(capability => {
      const severity = getGapSeverity('missing_capabilities');
      processedGaps[severity].push({
        type: 'Missing Capability',
        message: `Capability "${capability}" is not implemented`,
        severity,
        icon: getGapIcon(severity),
      });
    });

    // Process orphaned tokens
    gaps.orphaned_tokens?.forEach(token => {
      const severity = getGapSeverity('orphaned_tokens');
      processedGaps[severity].push({
        type: 'Orphaned Token',
        message: `Token "${token.token}" is defined but not used`,
        location: `Defined in: ${token.defined_in.join(', ')}`,
        severity,
        icon: getGapIcon(severity),
      });
    });

    // Process coverage gaps
    gaps.coverage_gaps?.forEach(gap => {
      const severity = getGapSeverity('coverage_gaps');
      processedGaps[severity].push({
        type: 'Coverage Gap',
        message: `${gap.capability} has ${gap.actual_coverage}% coverage (expected ${gap.expected_coverage}%)`,
        location: `Missing scenarios: ${gap.missing_scenarios.join(', ')}`,
        severity,
        icon: getGapIcon(severity),
      });
    });

    // Process duplicates
    gaps.duplicates?.forEach(duplicate => {
      const severity = getGapSeverity('duplicates');
      processedGaps[severity].push({
        type: 'Duplicate',
        message: `Duplicate ${duplicate.type}: "${duplicate.name}"`,
        location: `Found in: ${duplicate.locations.join(', ')}`,
        severity,
        icon: getGapIcon(severity),
      });
    });

    return processedGaps;
  };

  const toggleSection = (severity: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(severity)) {
      newExpanded.delete(severity);
    } else {
      newExpanded.add(severity);
    }
    setExpandedSections(newExpanded);
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getSeverityHeaderColor = (severity: string): string => {
    switch (severity) {
      case 'high':
        return 'text-red-800 bg-red-100';
      case 'medium':
        return 'text-yellow-800 bg-yellow-100';
      case 'low':
        return 'text-blue-800 bg-blue-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading gap analysis...</p>
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
          <p className="text-red-700 font-medium">Error loading gaps</p>
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

  if (!gapData) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <p>No gap data available</p>
        </div>
      </div>
    );
  }

  const processedGaps = processGaps(gapData);
  const totalGaps = Object.values(processedGaps).reduce((sum, gaps) => sum + gaps.length, 0);

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <div className="p-4">
        {/* Header with summary */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900">Gap Analysis</h3>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              Total gaps: <span className="font-medium">{totalGaps}</span>
            </span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span className="text-red-700">{processedGaps.high.length} high</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-yellow-700">{processedGaps.medium.length} medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-blue-700">{processedGaps.low.length} low</span>
              </div>
            </div>
          </div>
        </div>

        {totalGaps === 0 ? (
          <div className="text-center py-12">
            <div className="text-green-500 mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No gaps found!</h4>
            <p className="text-gray-600">
              Your specification appears to be complete according to the validation rules.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(processedGaps).map(([severity, gaps]) => {
              if (gaps.length === 0) return null;

              return (
                <div key={severity} className={`border rounded-lg ${getSeverityColor(severity)}`}>
                  <button
                    onClick={() => toggleSection(severity)}
                    className={`w-full px-4 py-3 text-left rounded-t-lg ${getSeverityHeaderColor(severity)} hover:opacity-80 transition-opacity`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{severity} Priority</span>
                        <span className="px-2 py-1 text-xs rounded-full bg-white/50">
                          {gaps.length}
                        </span>
                      </div>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${
                          expandedSections.has(severity) ? 'rotate-90' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>

                  {expandedSections.has(severity) && (
                    <div className="px-4 pb-4">
                      <div className="space-y-3">
                        {gaps.map((gap, index) => (
                          <div
                            key={index}
                            className="bg-white rounded-md p-3 border border-gray-200"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 mt-0.5">{gap.icon}</div>
                              <div className="flex-grow">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    {gap.type}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-900 font-medium">{gap.message}</p>
                                {gap.location && (
                                  <p className="text-xs text-gray-600 mt-1">{gap.location}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GapsChecklist;
