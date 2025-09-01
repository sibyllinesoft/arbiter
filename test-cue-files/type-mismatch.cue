// Test file with type mismatch
{
  config: {
    enabled: true
    enabled: "yes"  // Conflicting values - boolean vs string
  }
}