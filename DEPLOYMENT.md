# Deployment Guide

This guide provides comprehensive instructions for deploying Arbiter in various environments, from development to production.

## Prerequisites

### Required Software

- **Bun** >= 1.0.0 (JavaScript runtime)
- **CUE CLI** >= 0.8.0 (Configuration language tools)
- **Docker** >= 20.10.0 (for containerized deployment)
- **Docker Compose** >= 2.0.0 (for local development)

### System Requirements

#### Minimum Requirements
- **CPU**: 1 core
- **Memory**: 512MB RAM
- **Storage**: 1GB available disk space
- **Network**: HTTP/HTTPS (80/443) and WebSocket support

#### Recommended Requirements
- **CPU**: 2+ cores
- **Memory**: 2GB+ RAM
- **Storage**: 10GB+ available disk space (for project data)
- **Network**: Low latency connection for real-time collaboration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `development` | No |
| `PORT` | API server port | `3001` | No |
| `DB_PATH` | SQLite database path | `./data/arbiter.db` | No |
| `VITE_API_URL` | Frontend API endpoint | `http://localhost:3001` | No |
| `VITE_WS_URL` | Frontend WebSocket endpoint | `ws://localhost:3001` | No |

## Development Deployment

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd arbiter
   ```

2. **Install Bun runtime:**
   ```bash
   curl -fsSL https://bun.sh/install | bash
   source ~/.bashrc  # or restart terminal
   ```

3. **Install CUE CLI:**
   ```bash
   # macOS
   brew install cue-lang/tap/cue
   
   # Linux
   curl -L https://github.com/cue-lang/cue/releases/download/v0.8.2/cue_v0.8.2_linux_amd64.tar.gz | tar -xz
   sudo mv cue /usr/local/bin/
   
   # Windows
   # Download from https://github.com/cue-lang/cue/releases
   ```

4. **Install project dependencies:**
   ```bash
   bun install
   ```

5. **Start development servers:**
   ```bash
   # Starts both API (3001) and Web (5173)
   bun run dev
   ```

6. **Access the application:**
   - Web Interface: http://localhost:5173
   - API Server: http://localhost:3001
   - WebSocket: ws://localhost:3001

### Development Commands

```bash
# Individual service startup
bun run --cwd apps/api dev        # API server only
bun run --cwd apps/web dev         # Web app only

# Build and type checking
bun run build                      # Build all packages
bun run typecheck                  # Type check all packages
bun run lint                       # Lint all packages

# Testing
bun run test                       # Run all tests
bun run e2e                        # End-to-end tests

# Cleanup
rm -rf node_modules */node_modules # Clean dependencies
rm -rf data/                       # Clean database (development only)
```

## Docker Development

### Quick Start with Docker Compose

1. **Build and start services:**
   ```bash
   docker compose up --build
   ```

2. **Access the application:**
   - Web Interface: http://localhost:5173
   - API Server: http://localhost:3001

3. **Stop services:**
   ```bash
   docker compose down
   ```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - DB_PATH=/app/data/arbiter.db
    volumes:
      - ./data:/app/data          # Persistent database
      - ./examples:/app/examples:ro # Sample files
    networks:
      - arbiter

  web:
    build:
      context: .
      dockerfile: Dockerfile.web  # Note: Create this file
    ports:
      - "5173:80"
    depends_on:
      - api
    environment:
      - VITE_API_URL=http://api:3001
      - VITE_WS_URL=ws://api:3001
    networks:
      - arbiter

networks:
  arbiter:
    driver: bridge
```

### Docker Commands

```bash
# Build images
docker compose build

# Start services in background
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f web

# Scale API instances
docker compose up -d --scale api=3

# Execute commands in containers
docker compose exec api bun --version
docker compose exec api cue version

# Clean up
docker compose down -v        # Remove containers and volumes
docker system prune -a        # Clean up unused images
```

## Production Deployment

### Single Server Deployment

#### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. Application Setup

```bash
# Create application directory
sudo mkdir -p /opt/arbiter
cd /opt/arbiter

# Clone repository (or copy files)
git clone <repository-url> .

# Create data directory with proper permissions
sudo mkdir -p data
sudo chown -R 1000:1000 data  # bun user in container
```

#### 3. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3001:3001"  # Bind to localhost only
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/arbiter.db
    volumes:
      - ./data:/app/data:rw
      - ./examples:/app/examples:ro
    networks:
      - arbiter
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/projects"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    restart: unless-stopped
    ports:
      - "127.0.0.1:5173:80"  # Bind to localhost only
    depends_on:
      api:
        condition: service_healthy
    environment:
      - VITE_API_URL=https://your-domain.com/api  # Production URL
      - VITE_WS_URL=wss://your-domain.com/ws     # Production WebSocket
    networks:
      - arbiter
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  arbiter:
    driver: bridge

volumes:
  arbiter-data:
    driver: local
```

#### 4. Reverse Proxy (Nginx)

Create `/etc/nginx/sites-available/arbiter`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Frontend (static files)
    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'https://your-domain.com' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, x-client-id' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
    }
    
    # WebSocket proxying
    location /ws/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout settings
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/arbiter /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install snapd
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 6. Start Production Services

```bash
cd /opt/arbiter
docker compose -f docker-compose.prod.yml up -d

# Verify services are running
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Multi-Server Deployment (Scalable)

For high-availability deployments, consider this architecture:

```
┌─────────────────┐
│ Load Balancer   │ (HAProxy/Nginx)
│ (SSL Termination)│
└─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│App 1  │ │App 2  │ (Multiple API instances)
└───────┘ └───────┘
    │         │
    └────┬────┘
         │
┌────────▼──────┐
│ PostgreSQL    │ (Shared database)
│ + Redis Cache │
└───────────────┘
```

#### Database Migration (SQLite → PostgreSQL)

For production scale, migrate to PostgreSQL:

1. **Install PostgreSQL:**
   ```bash
   sudo apt install postgresql postgresql-contrib
   sudo -u postgres createdb arbiter_prod
   sudo -u postgres createuser arbiter_user
   ```

2. **Update connection string in application**
3. **Migrate data using appropriate tools**

#### Load Balancer Configuration (HAProxy)

```haproxy
# /etc/haproxy/haproxy.cfg
global
    daemon
    user haproxy
    group haproxy

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms

frontend arbiter_frontend
    bind *:80
    bind *:443 ssl crt /path/to/ssl/cert.pem
    redirect scheme https if !{ ssl_fc }
    
    # Route WebSocket connections (sticky sessions required)
    acl is_websocket hdr(Upgrade) -i websocket
    use_backend arbiter_websocket if is_websocket
    
    default_backend arbiter_api

backend arbiter_api
    balance roundrobin
    option httpchk GET /projects
    server api1 127.0.0.1:3001 check
    server api2 127.0.0.1:3002 check
    server api3 127.0.0.1:3003 check

backend arbiter_websocket
    balance source  # Sticky sessions for WebSocket
    option httpchk GET /projects
    server ws1 127.0.0.1:3001 check
    server ws2 127.0.0.1:3002 check
    server ws3 127.0.0.1:3003 check
```

## Cloud Deployment

### AWS Deployment

#### ECS (Elastic Container Service)

1. **Create ECR repositories:**
   ```bash
   aws ecr create-repository --repository-name arbiter/api
   aws ecr create-repository --repository-name arbiter/web
   ```

2. **Build and push images:**
   ```bash
   # Get login token
   aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com

   # Build and tag images
   docker build -t arbiter-api .
   docker tag arbiter-api:latest <account-id>.dkr.ecr.us-west-2.amazonaws.com/arbiter/api:latest
   docker push <account-id>.dkr.ecr.us-west-2.amazonaws.com/arbiter/api:latest
   ```

3. **Create ECS task definition and service**

#### AWS App Runner

For simpler deployment, use AWS App Runner:

```yaml
# apprunner.yaml
version: 1.0
runtime: docker
build:
  commands:
    build:
      - echo "Building with Docker"
run:
  runtime-version: latest
  command: bun server.ts
  network:
    port: 3001
  env:
    - name: NODE_ENV
      value: production
    - name: PORT
      value: 3001
```

### Google Cloud Deployment

#### Cloud Run

1. **Build and deploy:**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT-ID/arbiter-api
   gcloud run deploy arbiter-api --image gcr.io/PROJECT-ID/arbiter-api --platform managed
   ```

2. **Configure environment variables:**
   ```bash
   gcloud run services update arbiter-api \
     --set-env-vars NODE_ENV=production,DB_PATH=/app/data/arbiter.db
   ```

### Azure Deployment

#### Container Instances

```bash
az container create \
  --resource-group myResourceGroup \
  --name arbiter-api \
  --image arbiter-api:latest \
  --dns-name-label arbiter-api \
  --ports 3001 \
  --environment-variables NODE_ENV=production
```

## Monitoring and Maintenance

### Health Checks

The application includes built-in health check endpoints:

```bash
# API health check
curl -f http://localhost:3001/projects

# Docker health check (automatic)
docker compose ps  # Shows health status
```

### Logging

#### Application Logs

```bash
# View real-time logs
docker compose logs -f api
docker compose logs -f web

# Export logs
docker compose logs api > api.log 2>&1
```

#### Log Rotation

```bash
# Configure Docker log rotation
cat > /etc/docker/daemon.json << EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

sudo systemctl restart docker
```

### Backup Strategy

#### Database Backup

```bash
# Backup SQLite database
cp data/arbiter.db data/backup/arbiter-$(date +%Y%m%d).db

# Automated backup script
#!/bin/bash
BACKUP_DIR="/opt/arbiter/backups"
DB_PATH="/opt/arbiter/data/arbiter.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/arbiter_$DATE.db"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "arbiter_*.db" -mtime +7 -delete
```

#### Full Application Backup

```bash
# Backup script
tar -czf arbiter-backup-$(date +%Y%m%d).tar.gz \
  -C /opt/arbiter \
  data/ \
  examples/ \
  docker-compose.prod.yml \
  .env
```

### Updates and Maintenance

#### Application Updates

```bash
cd /opt/arbiter

# Pull latest changes
git pull origin main

# Rebuild containers
docker compose -f docker-compose.prod.yml build --no-cache

# Rolling update (zero downtime)
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml up -d --no-deps web

# Verify deployment
docker compose -f docker-compose.prod.yml ps
curl -f https://your-domain.com/api/projects
```

#### System Maintenance

```bash
# Clean Docker system
docker system prune -a

# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart services if needed
sudo systemctl restart nginx
docker compose -f docker-compose.prod.yml restart
```

### Troubleshooting

#### Common Issues

1. **Port already in use:**
   ```bash
   sudo lsof -i :3001
   sudo kill -9 <PID>
   ```

2. **Permission errors:**
   ```bash
   sudo chown -R 1000:1000 /opt/arbiter/data
   ```

3. **WebSocket connection issues:**
   - Check firewall settings
   - Verify proxy WebSocket configuration
   - Ensure sticky sessions for load balancing

4. **CUE CLI not found:**
   ```bash
   # In container
   docker exec -it arbiter_api_1 which cue
   docker exec -it arbiter_api_1 cue version
   ```

5. **Database locked:**
   ```bash
   # Stop all services
   docker compose down
   # Restart
   docker compose up -d
   ```

#### Debug Commands

```bash
# Container shell access
docker compose exec api sh
docker compose exec web sh

# Check container logs
docker compose logs --tail=100 -f api

# Resource usage
docker stats

# Network connectivity
docker compose exec api ping web
docker compose exec web ping api
```

### Performance Optimization

#### Production Optimizations

1. **Enable HTTP/2 and compression in Nginx**
2. **Configure proper cache headers**
3. **Use CDN for static assets**
4. **Enable database connection pooling**
5. **Monitor and scale based on metrics**

#### Resource Limits

```yaml
# In docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

This deployment guide provides comprehensive coverage for getting Arbiter running in various environments, from development to production-scale deployments.