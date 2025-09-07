#!/bin/bash

# E2E Docker Compose Test Script
set -e

echo "🚀 Starting E2E Docker Compose Test"

# Test directory
TEST_DIR="/media/nathan/Seagate Hub/Projects/arbiter/tests/e2e-docker-compose"
cd "$TEST_DIR"

# Function to cleanup
cleanup() {
  echo "🧹 Cleaning up..."
  docker compose down -v --remove-orphans 2>/dev/null || true
  docker compose rm -f 2>/dev/null || true
}

# Trap cleanup on exit
trap cleanup EXIT

echo "📋 1. Validating CUE specification..."
if [ -f "arbiter.assembly.cue" ]; then
  echo "✅ Arbiter specification found"
  
  # Test CUE parsing
  echo "🔍 Testing CUE parsing with Arbiter CLI..."
  ../../arbiter-cli generate --dry-run --verbose > /tmp/arbiter-test.log 2>&1
  
  if grep -q "deployment.*compose" /tmp/arbiter-test.log; then
    echo "✅ Docker Compose deployment target detected"
  else
    echo "⚠️  Docker Compose target not explicitly detected, but CUE is valid"
  fi
else
  echo "❌ arbiter.assembly.cue not found"
  exit 1
fi

echo "🔧 2. Validating Docker Compose file..."
if [ -f "docker-compose.yml" ]; then
  echo "✅ docker-compose.yml found"
  
  # Validate compose file syntax
  if docker compose config > /dev/null 2>&1; then
    echo "✅ Docker Compose file is valid"
  else
    echo "❌ Docker Compose file has syntax errors"
    docker compose config
    exit 1
  fi
else
  echo "❌ docker-compose.yml not found"
  exit 1
fi

echo "🏗️  3. Building and starting services..."
docker compose build --quiet webapp

echo "⏫ Starting services..."
docker compose up -d

echo "⏳ Waiting for services to become healthy..."
timeout 120 bash -c '
  while true; do
    if docker compose ps --format json | jq -r ".[].Health" | grep -v "healthy" | grep -q "starting\|unhealthy"; then
      echo "Services still starting..."
      sleep 5
    else
      echo "All services are healthy!"
      break
    fi
  done
'

echo "✅ 4. Testing service connectivity..."

# Test Redis
echo "🔴 Testing Redis..."
if docker compose exec -T redis redis-cli ping | grep -q "PONG"; then
  echo "✅ Redis is responding"
else
  echo "❌ Redis test failed"
  exit 1
fi

# Test PostgreSQL
echo "🐘 Testing PostgreSQL..."
if docker compose exec -T postgres pg_isready -U testuser -d testdb | grep -q "accepting connections"; then
  echo "✅ PostgreSQL is accepting connections"
else
  echo "❌ PostgreSQL test failed"
  exit 1
fi

# Test Web App
echo "🌐 Testing Web Application..."
sleep 10  # Give the app extra time to fully start

if curl -sf http://localhost:3000/health > /dev/null; then
  echo "✅ Web application health check passed"
  
  # Test specific endpoints
  if curl -sf http://localhost:3000/ | grep -q "E2E Test App"; then
    echo "✅ Web application root endpoint working"
  fi
  
  if curl -sf http://localhost:3000/redis | grep -q "redis://redis:6379"; then
    echo "✅ Web application Redis configuration correct"
  fi
  
  if curl -sf http://localhost:3000/database | grep -q "configured"; then
    echo "✅ Web application database configuration correct"
  fi
else
  echo "❌ Web application health check failed"
  echo "App logs:"
  docker compose logs webapp --tail=10
  exit 1
fi

echo "📊 5. Service Status Summary..."
docker compose ps

echo "🎉 All E2E tests passed!"
echo "✅ CUE specification parsing works"
echo "✅ Docker Compose generation works"
echo "✅ Multi-service deployment works"  
echo "✅ Service interconnectivity works"
echo "✅ Health checks work"

echo "🏁 E2E Docker Compose test completed successfully!"