// Test file with incomplete value error
{
  config: {
    host: string  // Incomplete - no concrete value
    port: int & >0
  }
}