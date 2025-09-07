import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

/**
 * End-to-end tests for Docker Compose functionality
 * Tests CUE spec generation, container orchestration, and service connectivity
 */
describe('Docker Compose E2E Tests', () => {
  const testDir = __dirname;
  const dockerComposeFile = path.join(testDir, 'docker-compose.generated.yml');
  const projectName = 'e2e-test-stack';
  
  let servicesUp = false;

  beforeAll(async () => {
    console.log('🚀 Setting up e2e test environment...');
    
    // Clean up any existing containers/volumes
    try {
      execSync(`docker compose -f ${dockerComposeFile} -p ${projectName} down -v --remove-orphans`, {
        stdio: 'ignore'
      });
    } catch (error) {
      // Ignore errors if nothing to clean up
    }
    
    // Generate docker-compose.yml from CUE spec
    console.log('📝 Generating docker-compose.yml from CUE spec...');
    generateDockerCompose();
    
    // Verify the generated file exists and is valid
    expect(fs.existsSync(dockerComposeFile)).toBe(true);
    
    // Validate JSON/YAML content (CUE exports JSON by default)
    const content = fs.readFileSync(dockerComposeFile, 'utf8');
    expect(content.length).toBeGreaterThan(100);
    // CUE exports JSON, so check for JSON format
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe('3.8');
    expect(parsed.services).toBeDefined();
    
    console.log('✅ Docker Compose file generated successfully');
  }, 60000);

  afterAll(async () => {
    console.log('🧹 Cleaning up test environment...');
    
    if (servicesUp) {
      try {
        console.log('⬇️ Stopping Docker Compose services...');
        execSync(`docker compose -f ${dockerComposeFile} -p ${projectName} down -v --remove-orphans`, {
          stdio: 'inherit',
          timeout: 30000
        });
        console.log('✅ Services stopped successfully');
      } catch (error) {
        console.error('❌ Error stopping services:', error);
      }
    }
    
    // Clean up generated file
    if (fs.existsSync(dockerComposeFile)) {
      fs.unlinkSync(dockerComposeFile);
    }
    
    console.log('✅ Cleanup completed');
  }, 60000);

  test('should generate valid docker-compose.yml from CUE spec', () => {
    const yamlContent = fs.readFileSync(dockerComposeFile, 'utf8');
    
    // Check for expected services (JSON format)
    expect(yamlContent).toContain('"redis"');
    expect(yamlContent).toContain('"postgres"');
    expect(yamlContent).toContain('"app"');
    expect(yamlContent).toContain('"nginx"');
    
    // Check for network configuration
    expect(yamlContent).toContain('"networks"');
    expect(yamlContent).toContain('e2e-network');
    
    // Check for volume configuration
    expect(yamlContent).toContain('"volumes"');
    expect(yamlContent).toContain('postgres_data');
    
    console.log('✅ Generated docker-compose.yml is valid');
  });

  test('should build and start all services', async () => {
    console.log('🏗️ Building and starting services...');
    
    try {
      // Build services (for the Node.js app)
      console.log('Building services...');
      execSync(`docker compose -f ${dockerComposeFile} -p ${projectName} build --no-cache`, {
        stdio: 'inherit',
        timeout: 120000
      });
      
      // Start services
      console.log('Starting services...');
      execSync(`docker compose -f ${dockerComposeFile} -p ${projectName} up -d`, {
        stdio: 'inherit',
        timeout: 60000
      });
      
      servicesUp = true;
      console.log('✅ Services started successfully');
      
      // Wait for services to be ready
      console.log('⏳ Waiting for services to become ready...');
      await waitForServicesReady();
      
    } catch (error) {
      console.error('❌ Failed to start services:', error);
      throw error;
    }
  }, 180000);

  test('should have all services healthy', async () => {
    console.log('🏥 Checking service health...');
    
    // Check service status
    const output = execSync(`docker compose -f ${dockerComposeFile} -p ${projectName} ps --format json`, {
      encoding: 'utf8'
    });
    
    const services = JSON.parse(`[${output.trim().split('\n').join(',')}]`);
    
    for (const service of services) {
      console.log(`Checking ${service.Service}: ${service.State} (${service.Health})`);
      expect(service.State).toBe('running');
      
      // Some services might not have health checks
      if (service.Health && service.Health !== '') {
        expect(service.Health).toBe('healthy');
      }
    }
    
    console.log('✅ All services are healthy');
  }, 60000);

  test('should allow Redis connectivity', async () => {
    console.log('🔗 Testing Redis connectivity...');
    
    try {
      const response = await fetch('http://localhost:3000/redis/test');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.value).toBe('Hello Redis!');
      
      console.log('✅ Redis connectivity test passed');
    } catch (error) {
      console.error('❌ Redis connectivity test failed:', error);
      throw error;
    }
  }, 30000);

  test('should allow PostgreSQL connectivity', async () => {
    console.log('🐘 Testing PostgreSQL connectivity...');
    
    try {
      const response = await fetch('http://localhost:3000/postgres/test');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.database_name).toBe('testdb');
      expect(data.data.user_name).toBe('testuser');
      
      console.log('✅ PostgreSQL connectivity test passed');
    } catch (error) {
      console.error('❌ PostgreSQL connectivity test failed:', error);
      throw error;
    }
  }, 30000);

  test('should allow Nginx reverse proxy access', async () => {
    console.log('🔀 Testing Nginx reverse proxy...');
    
    try {
      // Test through Nginx (port 8080)
      const response = await fetch('http://localhost:8080/health');
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.services.redis).toBe('connected');
      expect(data.services.postgres).toBe('connected');
      
      console.log('✅ Nginx reverse proxy test passed');
    } catch (error) {
      console.error('❌ Nginx reverse proxy test failed:', error);
      throw error;
    }
  }, 30000);

  test('should handle service interdependencies', async () => {
    console.log('🔄 Testing service dependencies...');
    
    // Test that the app can reach both Redis and PostgreSQL
    const healthResponse = await fetch('http://localhost:3000/health');
    expect(healthResponse.ok).toBe(true);
    
    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('healthy');
    expect(healthData.services.redis).toBe('connected');
    expect(healthData.services.postgres).toBe('connected');
    
    console.log('✅ Service dependencies are working correctly');
  }, 30000);

  test('should show proper service logs', async () => {
    console.log('📋 Checking service logs...');
    
    try {
      const logs = execSync(`docker compose -f ${dockerComposeFile} -p ${projectName} logs --tail=10`, {
        encoding: 'utf8',
        timeout: 10000
      });
      
      expect(logs.length).toBeGreaterThan(0);
      
      // Look for expected log patterns
      expect(logs).toMatch(/(redis|postgres|app|nginx)/i);
      
      console.log('✅ Service logs are available');
    } catch (error) {
      console.error('❌ Error checking logs:', error);
      throw error;
    }
  }, 15000);

  // Helper functions
  function generateDockerCompose() {
    try {
      const cueFile = path.join(testDir, 'specs/docker-compose.cue');
      const output = execSync(`cue export "${cueFile}" --expression dockerCompose`, {
        encoding: 'utf8',
        cwd: testDir
      });
      
      fs.writeFileSync(dockerComposeFile, output);
    } catch (error) {
      console.error('Failed to generate docker-compose.yml:', error);
      throw error;
    }
  }

  async function waitForServicesReady(maxAttempts = 30, interval = 5000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxAttempts}: Checking if services are ready...`);
        
        // Check if the main app health endpoint responds
        const response = await fetch('http://localhost:3000/health', {
          signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'healthy') {
            console.log('✅ Services are ready!');
            return;
          }
        }
      } catch (error) {
        console.log(`Attempt ${attempt}: Services not ready yet (${error.message})`);
      }
      
      if (attempt < maxAttempts) {
        await sleep(interval);
      }
    }
    
    throw new Error(`Services did not become ready after ${maxAttempts} attempts`);
  }
});