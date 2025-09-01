// Test file with constraint violation
{
  server: {
    port: int & >=1 & <=65535
    port: 99999  // Out of bounds constraint violation
  }
}