/**
 * CUE Plot Viewer component for rendering charts from CUE specifications.
 * Parses plot definitions from CUE exports and renders them with D3/Chart.js.
 */
import { BarChart3, LineChart, PieChart, TrendingUp, Zap } from "lucide-react";
import React, { useState, useMemo } from "react";
import { DataViewer } from "../diagrams/viewers/DataViewer";
import { Chart, type ChartData } from "./Chart";

/** Props for the CuePlotViewer component */
interface CuePlotViewerProps {
  /** JSON data exported from CUE containing plot definitions */
  plotData: Record<string, any>;
  /** Project ID for API calls */
  projectId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Display mode */
  mode?: "plots" | "raw" | "split";
}

/** Internal representation of a parsed plot definition */
interface ParsedPlot {
  name: string;
  title: string;
  type: "line" | "bar" | "scatter" | "pie" | "area";
  chartData: ChartData;
  rawData: any;
}

/** Build a dataset object from raw dataset data */
function buildDataset(dataset: any, chartType: string) {
  return {
    label: dataset.label || "Data",
    data: dataset.data || [],
    backgroundColor: dataset.backgroundColor || "#3b82f6",
    borderColor: dataset.borderColor || "#2563eb",
    fill: dataset.fill !== undefined ? dataset.fill : chartType === "area",
    borderWidth: dataset.borderWidth || 2,
  };
}

/** Build chart options with scales configuration */
function buildChartOptions(plotJson: any, chartType: string) {
  return {
    responsive: true,
    ...plotJson.options,
    scales: {
      x: {
        title: {
          display: true,
          text: chartType === "scatter" ? "X Values" : "Categories",
        },
        ...plotJson.options?.scales?.x,
      },
      y: {
        title: {
          display: true,
          text: "Values",
        },
        ...plotJson.options?.scales?.y,
      },
      ...plotJson.options?.scales,
    },
  };
}

/** Convert a CUE JSON plot definition to internal chart format */
function createPlotFromJson(plotName: string, plotJson: any): ParsedPlot | null {
  try {
    const title = plotJson.title || plotName;
    const type = plotJson.type || "line";

    if (!plotJson.data || !plotJson.data.datasets) {
      console.warn(`Plot ${plotName} missing required data.datasets field`);
      return null;
    }

    const chartData: ChartData = {
      title,
      type,
      data: {
        labels: plotJson.data.labels || [],
        datasets: plotJson.data.datasets.map((dataset: any) => buildDataset(dataset, type)),
      },
      options: buildChartOptions(plotJson, type),
    };

    return { name: plotName, title, type, chartData, rawData: plotJson };
  } catch (err) {
    console.error(`Error creating plot ${plotName}:`, err);
    return null;
  }
}

/** Get the appropriate icon component for a chart type */
function getPlotIcon(type: string) {
  switch (type) {
    case "line":
      return <LineChart className="w-4 h-4" />;
    case "bar":
      return <BarChart3 className="w-4 h-4" />;
    case "scatter":
      return <Zap className="w-4 h-4" />;
    case "pie":
      return <PieChart className="w-4 h-4" />;
    case "area":
      return <TrendingUp className="w-4 h-4" />;
    default:
      return <LineChart className="w-4 h-4" />;
  }
}

/** Check if a value looks like a chart definition */
function isChartDefinition(value: any): boolean {
  return typeof value === "object" && value !== null && "type" in value && "data" in value;
}

/** Parse all plots from the plot data */
function parsePlots(plotData: Record<string, any>): ParsedPlot[] {
  const plots: ParsedPlot[] = [];
  Object.entries(plotData).forEach(([key, value]) => {
    if (isChartDefinition(value)) {
      const plot = createPlotFromJson(key, value);
      if (plot) {
        plots.push(plot);
      }
    }
  });
  return plots;
}

/**
 * Component that renders charts from CUE plot specifications.
 * Supports line, bar, scatter, pie, and area chart types.
 */
export const CuePlotViewer: React.FC<CuePlotViewerProps> = ({
  plotData,
  projectId,
  className = "",
  mode = "plots",
}) => {
  const [selectedPlot, setSelectedPlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract plot definitions from JSON data exported by CUE
  const parsedPlots = useMemo(() => {
    try {
      setError(null);
      return parsePlots(plotData);
    } catch (err) {
      setError(`Failed to parse plot data: ${err}`);
      return [];
    }
  }, [plotData]);

  // Select first plot by default
  React.useEffect(() => {
    if (selectedPlot) return;

    const defaultPlot = parsedPlots[0];
    if (defaultPlot) {
      setSelectedPlot(defaultPlot.name);
    }
  }, [parsedPlots, selectedPlot]);

  const selectedPlotData = parsedPlots.find((plot) => plot.name === selectedPlot);

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="text-red-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Parse Error</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (parsedPlots.length === 0) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-8 text-center ${className}`}>
        <div className="text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-4" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Plots Found</h3>
        <p className="text-gray-600">
          No plot definitions found in the CUE source. Add plot definitions with type, data, and
          options.
        </p>
        <div className="mt-4 text-left bg-white border border-gray-200 rounded p-4">
          <h4 className="font-medium text-gray-900 mb-2">Example plot definition:</h4>
          <pre className="text-xs font-mono text-gray-600">
            {`myChart: {
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
}`}
          </pre>
        </div>
      </div>
    );
  }

  if (mode === "raw") {
    return (
      <div className={className}>
        <DataViewer
          data={plotData}
          language="json"
          title="Plot Data (JSON from CUE export)"
          showCopyButton={true}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Plot Visualization</h3>
          <p className="text-sm text-gray-600 mt-1">
            {parsedPlots.length} plot{parsedPlots.length !== 1 ? "s" : ""} found in CUE
            specification
          </p>
        </div>
      </div>

      {/* Plot selector */}
      {parsedPlots.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {parsedPlots.map((plot) => (
            <button
              key={plot.name}
              onClick={() => setSelectedPlot(plot.name)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                selectedPlot === plot.name
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {getPlotIcon(plot.type)}
              <span>{plot.title}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {plot.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Chart display */}
      {selectedPlotData && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          {mode === "split" ? (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Chart data={selectedPlotData.chartData} width={400} height={300} />
              </div>
              <div>
                <DataViewer
                  data={selectedPlotData.rawData}
                  language="json"
                  title={`${selectedPlotData.title} - JSON Data`}
                  showCopyButton={true}
                />
              </div>
            </div>
          ) : (
            <Chart data={selectedPlotData.chartData} width={800} height={400} />
          )}
        </div>
      )}
    </div>
  );
};

export default CuePlotViewer;
