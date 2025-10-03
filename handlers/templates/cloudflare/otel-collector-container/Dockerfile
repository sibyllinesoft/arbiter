# OpenTelemetry Collector container template for Arbiter Cloudflare Durable Objects
#
# Build with:
#   docker build -t arbiter-otel-collector handlers/templates/cloudflare/otel-collector-container
# Run locally:
#   docker run --rm -p 4318:4318 -e R2_BUCKET=your-bucket \
#     -e R2_ACCESS_KEY_ID=... -e R2_SECRET_ACCESS_KEY=... \
#     arbiter-otel-collector

FROM otel/opentelemetry-collector-contrib:0.104.0

COPY otel-collector-config.yaml /etc/otelcol-contrib/config.yaml

ENV R2_BUCKET="" \
    R2_BASE_PREFIX="otel/traces" \
    R2_REGION="auto" \
    R2_S3_ENDPOINT="https://example-account.r2.cloudflarestorage.com" \
    AWS_ACCESS_KEY_ID="" \
    AWS_SECRET_ACCESS_KEY="" \
    AWS_SESSION_TOKEN="" \
    AWS_REGION="auto"

EXPOSE 4317 4318

ENTRYPOINT ["/otelcol-contrib"]
CMD ["--config=/etc/otelcol-contrib/config.yaml"]
