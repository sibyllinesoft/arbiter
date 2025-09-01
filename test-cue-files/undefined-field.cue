// Test file with undefined field error
#Schema: {
  name: string
  port: int
}

config: #Schema & {
  name: "test"
  port: 8080
  extraField: "not allowed"  // Field not in schema
}