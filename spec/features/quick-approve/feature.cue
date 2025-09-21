feature: {
	id:    "quick-approve"
	title: "One-click invoice approval"
	owners: ["pm@example.com", "techlead@example.com"]
	state: "beta"
	scope: {routes: ["invoices:list", "invoices:detail"], flows: ["invoice_approve_send"]}
	completionProfile: {minFlows: 1, minOraclesPerFlow: 1, locatorCoveragePct: 0.95}
}
flows: [
	{
		id: "invoice_approve_send"
		steps: [
			{visit:            "invoices:detail?id={inv.id}"},
			{click:            "btn:Approve"},
			{expect: {locator: "badge:Approved", state: "visible"}},
		]
	},
]
locators: {"btn:Approve": "[data-testid=\"approve\"]"}
