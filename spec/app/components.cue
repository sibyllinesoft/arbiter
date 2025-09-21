components: schemas: {
	Money: {
		example: {amount: 120.00, currency: "USD"}
		rules: {amount: >=0}
	}
	InvoiceCreate: {
		example: {customerId: "C123", lines: [{desc: "Design", qty: 10, price: {amount: 120, currency: "USD"}}]}
	}
	Invoice: {
		example: {id: "inv_1", status: "DRAFT", customerId: "C123", lines: [{desc: "Design", qty: 10, price: {amount: 120, currency: "USD"}}]}
	}
}
