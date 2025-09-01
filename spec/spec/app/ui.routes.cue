ui: routes: [
  { id: "invoices:list",  path: "/invoices",     capabilities: ["list","create","view"], components: ["InvoiceTable","FilterBar","CreateButton"] },
  { id: "invoices:detail",path: "/invoices/:id", capabilities: ["edit","approve","send"], components: ["InvoiceForm","ActionsBar","StatusBadge"] },
]
