/**
 * D3 chart rendering functions for different chart types.
 * Each function handles the rendering logic for a specific chart type.
 */
import * as d3 from "d3";
import type { Selection } from "d3-selection";
import type { PieArcDatum } from "d3-shape";
import type { ChartData } from "./Chart";

type ChartGroup = Selection<SVGGElement, unknown, null, undefined>;

export interface RenderContext {
  g: ChartGroup;
  data: ChartData;
  innerWidth: number;
  innerHeight: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/** Render a line chart with dots and axis labels */
export function renderLineChart(ctx: RenderContext): void {
  const { g, data, innerWidth, innerHeight, margin } = ctx;
  const dataset = data.data.datasets[0];
  if (!dataset) return;
  const values = (dataset.data as number[]) ?? [];
  const labels = data.data.labels ?? [];

  if (values.length === 0) return;

  const scales = (data.options?.scales as any) ?? {};

  const xScale = d3
    .scaleLinear()
    .domain([0, values.length - 1])
    .range([0, innerWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(values) || 0])
    .range([innerHeight, 0]);

  const line = d3
    .line()
    .x((_d: number, i: number) => xScale(i))
    .y((d: number) => yScale(d))
    .curve(d3.curveMonotoneX);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3
        .axisBottom(xScale)
        .tickFormat((d: number | string, i: number) => labels[i] || d.toString()),
    );

  g.append("g").call(d3.axisLeft(yScale));

  g.append("path")
    .datum(values)
    .attr("fill", "none")
    .attr("stroke", dataset.borderColor || "#3b82f6")
    .attr("stroke-width", dataset.borderWidth || 2)
    .attr("d", line);

  g.selectAll(".dot")
    .data(values)
    .enter()
    .append("circle")
    .attr("class", "dot")
    .attr("cx", (d: number, i: number) => xScale(i))
    .attr("cy", (d: number) => yScale(d))
    .attr("r", 4)
    .attr("fill", dataset.backgroundColor || dataset.borderColor || "#3b82f6");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left + 15)
    .attr("x", 0 - innerHeight / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#6b7280")
    .text(scales?.y?.title?.text ?? "Values");

  g.append("text")
    .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`)
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#6b7280")
    .text(scales?.x?.title?.text ?? "Index");
}

/** Render a bar chart with colored bars */
export function renderBarChart(ctx: RenderContext): void {
  const { g, data, innerWidth, innerHeight } = ctx;
  const dataset = data.data.datasets[0];
  if (!dataset) return;
  const values = (dataset.data as number[]) ?? [];
  const labels = data.data.labels ?? [];

  if (values.length === 0) return;

  const xScale = d3
    .scaleBand()
    .domain(labels.map((d, i) => i.toString()))
    .range([0, innerWidth])
    .padding(0.1);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(values) || 0])
    .range([innerHeight, 0]);

  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickFormat((d: string | number, i: number) => labels[+d] || d));

  g.append("g").call(d3.axisLeft(yScale));

  g.selectAll(".bar")
    .data(values)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", (_d: number, i: number) => xScale(i.toString()) || 0)
    .attr("width", xScale.bandwidth())
    .attr("y", (d: number) => yScale(d))
    .attr("height", (d: number) => innerHeight - yScale(d))
    .attr("fill", (_d: number, i: number) => {
      const colors = dataset.backgroundColor as string[];
      return Array.isArray(colors) ? (colors[i] ?? colors[0] ?? "#3b82f6") : (colors ?? "#3b82f6");
    });
}

/** Render a scatter plot with colored points */
export function renderScatterPlot(ctx: RenderContext): void {
  const { g, data, innerWidth, innerHeight } = ctx;
  const dataset = data.data.datasets[0];
  if (!dataset) return;
  const points = (dataset.data as Array<{ x: number; y: number }>) ?? [];

  if (points.length === 0) return;

  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(points, (d: { x: number; y: number }) => d.x) as [number, number])
    .range([0, innerWidth]);

  const yScale = d3
    .scaleLinear()
    .domain(d3.extent(points, (d: { x: number; y: number }) => d.y) as [number, number])
    .range([innerHeight, 0]);

  g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));
  g.append("g").call(d3.axisLeft(yScale));

  g.selectAll(".point")
    .data(points)
    .enter()
    .append("circle")
    .attr("class", "point")
    .attr("cx", (d: { x: number; y: number }) => xScale(d.x))
    .attr("cy", (d: { x: number; y: number }) => yScale(d.y))
    .attr("r", 6)
    .attr("fill", dataset.backgroundColor || "#ef4444")
    .attr("stroke", dataset.borderColor || "#dc2626")
    .attr("stroke-width", 2);
}

/** Render a pie chart with labeled slices */
export function renderPieChart(ctx: RenderContext): void {
  const { g, data, innerWidth, innerHeight } = ctx;
  const dataset = data.data.datasets[0];
  if (!dataset) return;
  const values = (dataset.data as number[]) ?? [];
  const labels = data.data.labels ?? [];

  if (values.length === 0) return;

  const radius = Math.min(innerWidth, innerHeight) / 2;
  const centerX = innerWidth / 2;
  const centerY = innerHeight / 2;

  const pie = d3.pie().value((d: number) => d);
  const arc = d3.arc().innerRadius(0).outerRadius(radius);
  const pieData = pie(values);
  const colors = (dataset.backgroundColor as string[]) ?? [];

  g.selectAll<SVGGElement, PieArcDatum<number>>(".arc")
    .data(pieData)
    .enter()
    .append("g")
    .attr("class", "arc")
    .attr("transform", `translate(${centerX}, ${centerY})`)
    .each(function (d, i) {
      const group = d3.select(this);

      group
        .append("path")
        .attr("d", arc)
        .attr("fill", colors[i] || "#3b82f6")
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 2);

      const labelArc = d3
        .arc()
        .innerRadius(radius * 0.7)
        .outerRadius(radius * 0.7);

      group
        .append("text")
        .attr("transform", `translate(${labelArc.centroid(d)})`)
        .attr("dy", "0.35em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#374151")
        .text(labels[i]);
    });
}

/** Render an area chart with filled region */
export function renderAreaChart(ctx: RenderContext): void {
  const { g, data, innerWidth, innerHeight } = ctx;
  const dataset = data.data.datasets[0];
  if (!dataset) return;
  const values = (dataset.data as number[]) ?? [];

  if (values.length === 0) return;

  const xScale = d3
    .scaleLinear()
    .domain([0, values.length - 1])
    .range([0, innerWidth]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(values) || 0])
    .range([innerHeight, 0]);

  const area = d3
    .area()
    .x((_d: number, i: number) => xScale(i))
    .y0(innerHeight)
    .y1((d: number) => yScale(d))
    .curve(d3.curveMonotoneX);

  g.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));
  g.append("g").call(d3.axisLeft(yScale));

  g.append("path")
    .datum(values)
    .attr("fill", (dataset.backgroundColor as string) || "#3b82f6")
    .attr("opacity", 0.7)
    .attr("d", area);
}
