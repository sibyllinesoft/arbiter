package arbiter

{
	product: {
		name: "Arbiter"
		goals: [
			"Application goals will be defined here",
		]
	}
	ui: {
		routes: [
			{
				id:   "test-api:main"
				path: "/"
				capabilities: [
					"view",
				]
				components: [
					"Test-apiPage",
				]
			},
		]
	}
	locators: {
		"page:test-api": "[data-testid=\"test-api-page\"]"
	}
	flows: []
	config: {
		language: "typescript"
		kind:     "service"
	}
	metadata: {
		name:    "arbiter"
		version: "1.0.0"
	}
	deployment: {
		target: "kubernetes"
	}
	services: {
		"test-api": {
			serviceType:     "bespoke"
			language:        "typescript"
			type:            "deployment"
			sourceDirectory: "./src/test-api"
			ports: [
				{
					name:       "http"
					port:       3000
					targetPort: 3000
				},
			]
		}
	}
}
