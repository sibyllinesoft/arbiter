// @ts-nocheck
import * as d3 from 'd3';
import React, { useEffect, useRef } from 'react';

export interface ChartData {
  title?: string;
  type: 'line' | 'bar' | 'scatter' | 'pie' | 'area';
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
    scales?: any;
    plugins?: any;
    interaction?: any;
  };
}

interface ChartProps {
  data: ChartData;
  width?: number;
  height?: number;
  className?: string;
}

export const Chart: React.FC<ChartProps> = ({
  data,
  width = 800,
  height = 400,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const margin = { top: 40, right: 80, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Add title if present
    if (data.title) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .attr('class', 'chart-title')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .style('fill', '#374151')
        .text(data.title);
    }

    switch (data.type) {
      case 'line':
        renderLineChart();
        break;
      case 'bar':
        renderBarChart();
        break;
      case 'scatter':
        renderScatterPlot();
        break;
      case 'pie':
        renderPieChart();
        break;
      case 'area':
        renderAreaChart();
        break;
      default:
        console.warn(`Chart type '${data.type}' not supported`);
    }

    function renderLineChart() {
      const dataset = data.data.datasets[0];
      const values = dataset.data as number[];
      const labels = data.data.labels || [];

      if (values.length === 0) return;

      // Create scales
      const xScale = d3
        .scaleLinear()
        .domain([0, values.length - 1])
        .range([0, innerWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(values) || 0])
        .range([innerHeight, 0]);

      // Create line generator
      const line = d3
        .line<number>()
        .x((d, i) => xScale(i))
        .y(d => yScale(d))
        .curve(d3.curveMonotoneX);

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat((d, i) => labels[i] || d.toString()));

      g.append('g').call(d3.axisLeft(yScale));

      // Add line
      g.append('path')
        .datum(values)
        .attr('fill', 'none')
        .attr('stroke', dataset.borderColor || '#3b82f6')
        .attr('stroke-width', dataset.borderWidth || 2)
        .attr('d', line);

      // Add dots
      g.selectAll('.dot')
        .data(values)
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('cx', (d, i) => xScale(i))
        .attr('cy', d => yScale(d))
        .attr('r', 4)
        .attr('fill', dataset.backgroundColor || dataset.borderColor || '#3b82f6');

      // Add axis labels
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left + 15)
        .attr('x', 0 - innerHeight / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#6b7280')
        .text(data.options?.scales?.y?.title?.text || 'Values');

      g.append('text')
        .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + margin.bottom - 10})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .style('fill', '#6b7280')
        .text(data.options?.scales?.x?.title?.text || 'Index');
    }

    function renderBarChart() {
      const dataset = data.data.datasets[0];
      const values = dataset.data as number[];
      const labels = data.data.labels || [];

      if (values.length === 0) return;

      // Create scales
      const xScale = d3
        .scaleBand()
        .domain(labels.map((d, i) => i.toString()))
        .range([0, innerWidth])
        .padding(0.1);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(values) || 0])
        .range([innerHeight, 0]);

      // Add axes
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickFormat((d, i) => labels[+d] || d));

      g.append('g').call(d3.axisLeft(yScale));

      // Add bars
      g.selectAll('.bar')
        .data(values)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', (d, i) => xScale(i.toString()) || 0)
        .attr('width', xScale.bandwidth())
        .attr('y', d => yScale(d))
        .attr('height', d => innerHeight - yScale(d))
        .attr('fill', (d, i) => {
          const colors = dataset.backgroundColor as string[];
          return Array.isArray(colors) ? colors[i] || colors[0] : colors || '#3b82f6';
        });
    }

    function renderScatterPlot() {
      const dataset = data.data.datasets[0];
      const points = dataset.data as Array<{ x: number; y: number }>;

      if (points.length === 0) return;

      // Create scales
      const xScale = d3
        .scaleLinear()
        .domain(d3.extent(points, d => d.x) as [number, number])
        .range([0, innerWidth]);

      const yScale = d3
        .scaleLinear()
        .domain(d3.extent(points, d => d.y) as [number, number])
        .range([innerHeight, 0]);

      // Add axes
      g.append('g').attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));

      g.append('g').call(d3.axisLeft(yScale));

      // Add points
      g.selectAll('.point')
        .data(points)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.x))
        .attr('cy', d => yScale(d.y))
        .attr('r', 6)
        .attr('fill', dataset.backgroundColor || '#ef4444')
        .attr('stroke', dataset.borderColor || '#dc2626')
        .attr('stroke-width', 2);
    }

    function renderPieChart() {
      const dataset = data.data.datasets[0];
      const values = dataset.data as number[];
      const labels = data.data.labels || [];

      if (values.length === 0) return;

      const radius = Math.min(innerWidth, innerHeight) / 2;
      const centerX = innerWidth / 2;
      const centerY = innerHeight / 2;

      const pie = d3.pie<number>().value(d => d);

      const arc = d3.arc<d3.PieArcDatum<number>>().innerRadius(0).outerRadius(radius);

      const pieData = pie(values);
      const colors = dataset.backgroundColor as string[];

      // Add pie slices
      g.selectAll('.arc')
        .data(pieData)
        .enter()
        .append('g')
        .attr('class', 'arc')
        .attr('transform', `translate(${centerX}, ${centerY})`)
        .each(function (d, i) {
          const group = d3.select(this);

          group
            .append('path')
            .attr('d', arc)
            .attr('fill', colors[i] || '#3b82f6')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2);

          // Add labels
          const labelArc = d3
            .arc<d3.PieArcDatum<number>>()
            .innerRadius(radius * 0.7)
            .outerRadius(radius * 0.7);

          group
            .append('text')
            .attr('transform', `translate(${labelArc.centroid(d)})`)
            .attr('dy', '0.35em')
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#374151')
            .text(labels[i]);
        });
    }

    function renderAreaChart() {
      const dataset = data.data.datasets[0];
      const values = dataset.data as number[];

      if (values.length === 0) return;

      // Create scales
      const xScale = d3
        .scaleLinear()
        .domain([0, values.length - 1])
        .range([0, innerWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(values) || 0])
        .range([innerHeight, 0]);

      // Create area generator
      const area = d3
        .area<number>()
        .x((d, i) => xScale(i))
        .y0(innerHeight)
        .y1(d => yScale(d))
        .curve(d3.curveMonotoneX);

      // Add axes
      g.append('g').attr('transform', `translate(0,${innerHeight})`).call(d3.axisBottom(xScale));

      g.append('g').call(d3.axisLeft(yScale));

      // Add area
      g.append('path')
        .datum(values)
        .attr('fill', dataset.backgroundColor || '#3b82f6')
        .attr('opacity', 0.7)
        .attr('d', area);
    }
  }, [data, width, height]);

  return (
    <div className={`chart-container ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#ffffff' }}
      />
    </div>
  );
};

export default Chart;
