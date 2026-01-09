/**
 * D3-based chart component for rendering various chart types.
 * Supports line, bar, scatter, pie, and area charts.
 */
import * as d3 from "d3";
import React, { useEffect, useRef } from "react";
import {
  type RenderContext,
  renderAreaChart,
  renderBarChart,
  renderLineChart,
  renderPieChart,
  renderScatterPlot,
} from "./renderers";

export interface ChartData {
  title?: string;
  type: "line" | "bar" | "scatter" | "pie" | "area";
  data: {
    labels?: string[];
    datasets: Array<{
      label?: string;
      data: number[] | Array<{ x: number; y: number }>;
      backgroundColor?: string | string[];
      borderColor?: string | string[];
      fill?: boolean;
      borderWidth?: number;
    }>;
  };
  options?: {
    responsive?: boolean;
    scales?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
    interaction?: Record<string, unknown>;
  };
}

interface ChartProps {
  data: ChartData;
  width?: number;
  height?: number;
  className?: string;
}

/** Chart type to renderer lookup */
const CHART_RENDERERS: Record<ChartData["type"], (ctx: RenderContext) => void> = {
  line: renderLineChart,
  bar: renderBarChart,
  scatter: renderScatterPlot,
  pie: renderPieChart,
  area: renderAreaChart,
};

/** Add a title to the chart SVG */
function addChartTitle(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  title: string,
  width: number,
): void {
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .style("fill", "#374151")
    .text(title);
}

export const Chart: React.FC<ChartProps> = ({
  data,
  width = 800,
  height = 400,
  className = "",
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const margin = { top: 40, right: 80, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (data.title) {
      addChartTitle(svg, data.title, width);
    }

    const ctx: RenderContext = { g, data, innerWidth, innerHeight, margin };
    const renderer = CHART_RENDERERS[data.type];

    if (renderer) {
      renderer(ctx);
    } else {
      console.warn(`Chart type '${data.type}' not supported`);
    }
  }, [data, width, height]);

  return (
    <div className={`chart-container ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: "1px solid #e5e7eb", borderRadius: "0.5rem", backgroundColor: "#ffffff" }}
      />
    </div>
  );
};

export default Chart;
