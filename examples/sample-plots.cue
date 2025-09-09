// Sample plot data for testing plot rendering functionality
package plots

// Sample line chart data
lineChart: {
	title: "Server Response Time"
	type:  "line"
	data: {
		labels: ["00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"]
		datasets: [{
			label:           "Response Time (ms)"
			data:            [120, 150, 180, 160, 140, 130, 125]
			borderColor:     "#3b82f6"
			backgroundColor: "#dbeafe"
			fill:            false
		}]
	}
	options: {
		responsive: true
		scales: {
			y: {
				beginAtZero: true
				title: {
					display: true
					text:    "Response Time (ms)"
				}
			}
			x: {
				title: {
					display: true
					text:    "Time"
				}
			}
		}
	}
}

// Sample bar chart data
barChart: {
	title: "Service Usage by Hour"
	type:  "bar"
	data: {
		labels: ["API", "Database", "Cache", "Queue", "Storage"]
		datasets: [{
			label:           "Requests per Second"
			data:            [65, 59, 80, 81, 56]
			backgroundColor: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"]
			borderColor:     ["#dc2626", "#d97706", "#059669", "#2563eb", "#7c3aed"]
			borderWidth:     1
		}]
	}
	options: {
		responsive: true
		scales: {
			y: {
				beginAtZero: true
				title: {
					display: true
					text:    "Requests/sec"
				}
			}
		}
	}
}

// Sample scatter plot data
scatterPlot: {
	title: "Memory vs CPU Usage"
	type:  "scatter"
	data: {
		datasets: [{
			label: "Services"
			data: [
				{x: 10, y: 20},
				{x: 15, y: 35},
				{x: 25, y: 45},
				{x: 30, y: 55},
				{x: 35, y: 60},
				{x: 40, y: 70},
			]
			backgroundColor: "#ef4444"
			borderColor:     "#dc2626"
		}]
	}
	options: {
		responsive: true
		scales: {
			x: {
				type: "linear"
				position: "bottom"
				title: {
					display: true
					text:    "CPU Usage (%)"
				}
			}
			y: {
				title: {
					display: true
					text:    "Memory Usage (%)"
				}
			}
		}
	}
}

// Sample pie chart data
pieChart: {
	title: "Infrastructure Cost Breakdown"
	type:  "pie"
	data: {
		labels: ["Compute", "Storage", "Network", "Database", "Monitoring"]
		datasets: [{
			data:            [300, 150, 100, 200, 50]
			backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
			borderColor:     "#ffffff"
			borderWidth:     2
		}]
	}
	options: {
		responsive: true
		plugins: {
			legend: {
				position: "bottom"
			}
		}
	}
}

// Time series data with multiple metrics
timeSeriesChart: {
	title: "System Metrics Over Time"
	type:  "line"
	data: {
		labels: [
			"2024-01-01T00:00:00Z",
			"2024-01-01T01:00:00Z", 
			"2024-01-01T02:00:00Z",
			"2024-01-01T03:00:00Z",
			"2024-01-01T04:00:00Z",
			"2024-01-01T05:00:00Z",
		]
		datasets: [{
			label:           "CPU Usage (%)"
			data:            [45, 52, 48, 61, 55, 47]
			borderColor:     "#3b82f6"
			backgroundColor: "#dbeafe"
			fill:            false
		}, {
			label:           "Memory Usage (%)"
			data:            [62, 68, 71, 75, 73, 69]
			borderColor:     "#10b981"
			backgroundColor: "#d1fae5"
			fill:            false
		}, {
			label:           "Disk Usage (%)"
			data:            [80, 81, 82, 83, 84, 85]
			borderColor:     "#f59e0b"
			backgroundColor: "#fef3c7"
			fill:            false
		}]
	}
	options: {
		responsive: true
		interaction: {
			mode: "index"
			intersect: false
		}
		scales: {
			x: {
				display: true
				title: {
					display: true
					text:    "Time"
				}
			}
			y: {
				display: true
				title: {
					display: true
					text:    "Usage (%)"
				}
				min: 0
				max: 100
			}
		}
		plugins: {
			legend: {
				position: "top"
			}
			title: {
				display: true
				text:    "System Resource Usage"
			}
		}
	}
}

// Dashboard configuration with multiple charts
dashboard: {
	title: "Infrastructure Dashboard"
	layout: "grid"
	charts: [
		{name: "response_time", chart: lineChart},
		{name: "service_usage", chart: barChart},
		{name: "resource_usage", chart: scatterPlot},
		{name: "cost_breakdown", chart: pieChart},
		{name: "time_series", chart: timeSeriesChart, span: 2},
	]
}