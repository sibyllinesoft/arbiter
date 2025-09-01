# Multi-stage Dockerfile for Arbiter using Bun runtime
FROM oven/bun:1-alpine AS base

# Install CUE CLI
RUN apk add --no-cache curl
RUN curl -L https://github.com/cue-lang/cue/releases/download/v0.8.2/cue_v0.8.2_linux_amd64.tar.gz | tar -xz -C /tmp
RUN mv /tmp/cue /usr/local/bin/cue && chmod +x /usr/local/bin/cue

WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile

# Build stage  
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared package first
RUN cd packages/shared && bunx tsc

# Copy built shared package
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Production stage
FROM base AS production

# Copy dependencies and built code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY apps/api/server.ts ./apps/api/
COPY package.json ./

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown -R bun:bun /app/data

# Create examples directory and add sample CUE files
RUN mkdir -p /app/examples
COPY examples/ ./examples/

# Switch to bun user for security
USER bun

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/projects || exit 1

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/arbiter.db

# Run the API server
WORKDIR /app/apps/api
CMD ["bun", "server.ts"]