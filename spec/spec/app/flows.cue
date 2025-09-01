flows: [
  {
    id: "invoice_approve_send"
    preconditions: { role: "manager" }
    steps: [
      { visit: "invoices:detail?id={inv.id}" },
      { click: "btn:Approve" },
      { expect: { locator: "badge:Approved", state: "visible" } },
      { expect_api: { method: "POST", path: "/api/invoices/{inv.id}/send", status: 200 } },
    ]
  }
]
