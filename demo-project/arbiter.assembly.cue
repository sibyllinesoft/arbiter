package demoproject

{
	product: {
		name: "Demo-project"
		goals: [
			"Application goals will be defined here",
		]
	}
	ui: {
		routes: [
			{
				id:   "plotService:main"
				path: "/plotService"
				capabilities: [
					"view",
				]
				components: [
					"PlotservicePage",
				]
			},
		]
	}
	locators: {
		"page:plotService": "[data-testid=\"plotService-page\"]"
	}
	flows: []
	config: {
		language: "typescript"
		kind:     "service"
	}
	metadata: {
		name:    "demo-project"
		version: "1.0.0"
	}
	deployment: {
		target: "kubernetes"
	}
	services: {
		plotService: {
			type:            "internal"
			workload:        "deployment"
			language:        "typescript"
			source: { package: "./src/plotService" }
			sourceDirectory: "./src/plotService"
		}
	}
	plots: {
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
	}
}
