package arbiter

{
	product: {
		name: "Arbiter Friendly View"
		goals: [
			"Provide user-friendly specification viewing",
			"Enable non-technical stakeholders to understand specs",
		]
	}
	ui: {
		routes: [
			{
				id:   "friendly-view:main"
				path: "/specifications/{id}/friendly"
				capabilities: [
					"view_friendly",
					"navigate",
				]
				components: [
					"FriendlyViewPage",
					"SpecificationAccordion",
					"MetadataSection",
					"ServicesSection",
					"UIRoutesSection",
				]
			},
			{
				id:   "friendly-view:tab"
				path: "/specifications/{id}"
				capabilities: [
					"view",
					"tab_navigation",
				]
				components: [
					"SpecificationTabs",
					"FriendlyViewTab",
				]
			},
		]
	}
	locators: {
		"page:friendly-view":           "[data-testid=\"friendly-view-page\"]"
		"accordion:specification":       "[data-testid=\"specification-accordion\"]"
		"section:metadata":              "[data-testid=\"metadata-section\"]"
		"section:services":              "[data-testid=\"services-section\"]"
		"section:ui-routes":             "[data-testid=\"ui-routes-section\"]"
		"section:locators":              "[data-testid=\"locators-section\"]"
		"section:flows":                 "[data-testid=\"flows-section\"]"
		"section:deployment":            "[data-testid=\"deployment-section\"]"
		"tab:friendly-view":             "[data-testid=\"friendly-view-tab\"]"
		"button:expand-all":             "[data-testid=\"expand-all-button\"]"
		"button:collapse-all":           "[data-testid=\"collapse-all-button\"]"
		"accordion-item:metadata":       "[data-testid=\"accordion-metadata\"]"
		"accordion-item:services":       "[data-testid=\"accordion-services\"]"
		"accordion-item:ui-routes":      "[data-testid=\"accordion-ui-routes\"]"
		"accordion-item:locators":       "[data-testid=\"accordion-locators\"]"
		"accordion-item:flows":          "[data-testid=\"accordion-flows\"]"
		"accordion-item:deployment":     "[data-testid=\"accordion-deployment\"]"
	}
	flows: [
		{
			id:          "view-friendly-specification"
			description: "User views specification in friendly format"
			steps: [
				"Navigate to specification page",
				"Click friendly view tab",
				"Browse accordion sections",
				"Expand/collapse sections as needed",
			]
		},
	]
	config: {
		language: "typescript"
		kind:     "web-application"
	}
	metadata: {
		name:    "arbiter-friendly-view"
		version: "1.0.0"
	}
	deployment: {
		target: "web"
	}
	services: {
		"friendly-view": {
			serviceType:     "frontend"
			language:        "typescript"
			type:            "component"
			sourceDirectory: "./src/components/friendly-view"
			ports: [
				{
					name:       "web"
					port:       3000
					targetPort: 3000
				},
			]
		}
	}
}