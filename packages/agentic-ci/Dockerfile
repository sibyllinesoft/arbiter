FROM oven/bun:1.0-alpine as base

LABEL org.opencontainers.image.title="Agentic CI"
LABEL org.opencontainers.image.description="AI-powered CI/CD automation with auto-merge capabilities"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="Arbiter Team"

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    ca-certificates \
    tzdata

# Create non-root user
RUN addgroup -g 1001 -S agentic && \
    adduser -S agentic -u 1001 -G agentic

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build application
RUN bun run build

# Create directories for runtime
RUN mkdir -p /app/logs /app/data && \
    chown -R agentic:agentic /app

# Switch to non-root user
USER agentic

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose webhook port
EXPOSE 3000

# Default environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV WEBHOOK_PORT=3000

# Start the application
CMD ["bun", "run", "start"]