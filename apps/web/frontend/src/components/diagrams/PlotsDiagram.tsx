import React, { useState, useEffect } from 'react';
import { CuePlotViewer } from '../charts/CuePlotViewer';
import { apiService } from '../../services/api';
import { Loader2, AlertCircle, BarChart3 } from 'lucide-react';

interface PlotsDiagramProps {
  projectId: string;
}

const PlotsDiagram: React.FC<PlotsDiagramProps> = ({ projectId }) => {
  const [plotData, setPlotData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPlotData = async () => {
      try {
        setLoading(true);
        setError(null);

        // For now, use sample data while we fix the API integration
        const samplePlots = {
          plots: {
            lineChart: {
              title: "Server Response Time",
              type: "line",
              data: {
                labels: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"],
                datasets: [{
                  label: "Response Time (ms)",
                  data: [120, 150, 180, 160, 140, 130, 125],
                  backgroundColor: "#dbeafe",
                  borderColor: "#3b82f6",
                  fill: false
                }]
              },
              options: {
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Response Time (ms)"
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: "Time"
                    }
                  }
                }
              }
            },
            barChart: {
              title: "Service Usage by Hour",
              type: "bar",
              data: {
                labels: ["API", "Database", "Cache", "Queue", "Storage"],
                datasets: [{
                  label: "Requests per Second",
                  data: [65, 59, 80, 81, 56],
                  backgroundColor: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"],
                  borderColor: ["#dc2626", "#d97706", "#059669", "#2563eb", "#7c3aed"],
                  borderWidth: 1
                }]
              },
              options: {
                responsive: true,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: "Requests/sec"
                    }
                  }
                }
              }
            },
            timeSeriesChart: {
              title: "System Metrics Over Time",
              type: "line",
              data: {
                labels: [
                  "2024-01-01T00:00:00Z",
                  "2024-01-01T01:00:00Z",
                  "2024-01-01T02:00:00Z",
                  "2024-01-01T03:00:00Z",
                  "2024-01-01T04:00:00Z",
                  "2024-01-01T05:00:00Z"
                ],
                datasets: [{
                  label: "CPU Usage (%)",
                  data: [45, 52, 48, 61, 55, 47],
                  borderColor: "#3b82f6",
                  backgroundColor: "#dbeafe",
                  fill: false
                }, {
                  label: "Memory Usage (%)",
                  data: [62, 68, 71, 75, 73, 69],
                  borderColor: "#10b981",
                  backgroundColor: "#d1fae5",
                  fill: false
                }]
              },
              options: {
                responsive: true,
                interaction: {
                  mode: "index",
                  intersect: false
                },
                scales: {
                  x: {
                    display: true,
                    title: {
                      display: true,
                      text: "Time"
                    }
                  },
                  y: {
                    display: true,
                    title: {
                      display: true,
                      text: "Usage (%)"
                    },
                    min: 0,
                    max: 100
                  }
                },
                plugins: {
                  legend: {
                    position: "top"
                  },
                  title: {
                    display: true,
                    text: "System Resource Usage"
                  }
                }
              }
            }
          }
        };
        
        setPlotData(samplePlots);

        // TODO: Uncomment when API integration is working
        // const resolved = await apiService.getResolvedSpec(projectId);
        // if (resolved && resolved.resolved && resolved.resolved.plots) {
        //   setPlotData(resolved.resolved);
        // }
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load plot data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load plot data');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadPlotData();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="diagram-container">
        <div className="diagram-loading">
          <div className="text-center">
            <Loader2 className="h-8 w-8 mb-4 mx-auto animate-spin text-blue-500" />
            <p className="text-gray-600">Loading plot data...</p>
            <p className="text-sm text-gray-400 mt-2">
              Parsing CUE specifications for visualization data
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diagram-container">
        <div className="diagram-error">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Failed to Load Plot Data
            </h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!plotData || Object.keys(plotData).length === 0) {
    return (
      <div className="diagram-container">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            No Plot Data Available
          </h3>
          <p className="text-gray-600 mb-4">
            No visualization data found in the CUE specification.
          </p>
          <div className="text-left bg-white border border-gray-200 rounded-lg p-4 max-w-md mx-auto">
            <h4 className="font-medium text-gray-900 mb-2">
              To add plots, define them in your CUE files then export as JSON:
            </h4>
            <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
{`// In your CUE file:
myChart: {
  title: "Sample Chart"
  type: "line"
  data: {
    labels: ["Jan", "Feb", "Mar"]
    datasets: [{
      label: "Sales"
      data: [100, 150, 200]
      backgroundColor: "#3b82f6"
    }]
  }
}

// Export with: cue export -o plots.json`}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="diagram-container h-full overflow-auto">
      <div className="p-6">
        <CuePlotViewer
          plotData={plotData}
          projectId={projectId}
          mode="plots"
          className="h-full"
        />
      </div>
    </div>
  );
};

export default PlotsDiagram;