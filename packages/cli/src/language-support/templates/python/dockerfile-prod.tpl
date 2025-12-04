
# Builder stage
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update     && apt-get install -y --no-install-recommends         build-essential         libpq-dev     && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --user --no-cache-dir --upgrade pip     && pip install --user --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update     && apt-get install -y --no-install-recommends         libpq5         curl     && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' --uid 1000 appuser     && chown -R appuser:appuser /app
USER appuser

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3     CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
