const express = require('express');
const redis = require('redis');
const { Client } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Redis client setup
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// PostgreSQL client setup
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://testuser:testpass@localhost:5432/testdb'
});

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    await redisClient.ping();
    
    // Check PostgreSQL connection
    await pgClient.query('SELECT 1');
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        postgres: 'connected'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Test endpoint for Redis
app.get('/redis/test', async (req, res) => {
  try {
    const testKey = 'test:' + Date.now();
    const testValue = 'Hello Redis!';
    
    await redisClient.set(testKey, testValue, { EX: 60 });
    const retrievedValue = await redisClient.get(testKey);
    
    res.json({
      success: true,
      key: testKey,
      value: retrievedValue,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Redis test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint for PostgreSQL
app.get('/postgres/test', async (req, res) => {
  try {
    const result = await pgClient.query(`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as version,
        now() as timestamp
    `);
    
    res.json({
      success: true,
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('PostgreSQL test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'E2E Test Application',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/health',
      '/redis/test',
      '/postgres/test'
    ]
  });
});

// Initialize connections and start server
async function startServer() {
  try {
    // Connect to Redis
    await redisClient.connect();
    console.log('Connected to Redis');
    
    // Connect to PostgreSQL
    await pgClient.connect();
    console.log('Connected to PostgreSQL');
    
    // Test database setup
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT
      )
    `);
    
    // Start the server
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
      console.log('Available endpoints:');
      console.log('  GET /health - Health check');
      console.log('  GET /redis/test - Redis connectivity test');
      console.log('  GET /postgres/test - PostgreSQL connectivity test');
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await redisClient.quit();
  await pgClient.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await redisClient.quit();
  await pgClient.end();
  process.exit(0);
});

startServer();