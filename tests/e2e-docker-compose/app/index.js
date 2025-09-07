const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'E2E Test App',
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Test Redis connection
app.get('/redis', (req, res) => {
  res.json({
    redis_url: process.env.REDIS_URL || 'not configured',
    status: 'connected'
  });
});

// Test Database connection
app.get('/database', (req, res) => {
  res.json({
    database_url: process.env.DATABASE_URL ? 'configured' : 'not configured',
    status: 'connected'
  });
});

app.listen(port, () => {
  console.log(`E2E test app listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Redis URL: ${process.env.REDIS_URL}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);
});