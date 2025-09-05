testability: {
  network: { stub: true, passthrough: ["/auth/*"] }
  clock:   { fixed: "2025-03-01T12:00:00Z" }
  seeds:   { factories: { invoice: { id: "uuid()", status: "DRAFT" } } }
}
