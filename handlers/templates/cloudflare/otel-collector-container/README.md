# Arbiter OpenTelemetry Collector (Cloudflare Template)

This container template wraps the official
[`otel/opentelemetry-collector-contrib`](https://hub.docker.com/r/otel/opentelemetry-collector-contrib)
image with a configuration tuned for Arbiter Cloudflare Durable Objects. It
accepts OTLP traces over gRPC or HTTP and forwards them to a Cloudflare R2
bucket using the S3-compatible `awss3` exporter.

## Environment Variables

| Variable                                      | Description                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `R2_BUCKET`                                   | Target R2 bucket for exported telemetry objects (required).                    |
| `R2_S3_ENDPOINT`                              | R2 S3-compatible endpoint (e.g. `https://<account>.r2.cloudflarestorage.com`). |
| `R2_BASE_PREFIX`                              | Base key prefix inside the bucket (default: `otel/traces`).                    |
| `R2_REGION`                                   | Logical region label for resource attributes (default: `auto`).                |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Credentials for the R2 access key.                                             |
| `AWS_SESSION_TOKEN`                           | Optional session token for temporary credentials.                              |
| `OTEL_ENVIRONMENT`                            | Optional environment label forwarded into OTLP resource attributes.            |

## Running Locally

```bash
docker build -t arbiter-otel-collector handlers/templates/cloudflare/otel-collector-container

docker run --rm -p 4318:4318 \
  -e R2_BUCKET=my-observability-bucket \
  -e R2_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
  -e AWS_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
  arbiter-otel-collector
```

The collector exposes OTLP/gRPC on `4317` and OTLP/HTTP on `4318`. It also
registers health endpoints provided by the default extensions (`/health`,
`/debug/pprof`, and `/debug/servicez`).

## Output Format in R2

Telemetry spans are written as gzipped OTLP JSON documents using the structure:

```
<base-prefix>/traces/year=YYYY/month=MM/day=DD/hour=HH/minute=mm/otel-trace-<uuid>.json.gz
```

## Customising the Pipeline

Edit `otel-collector-config.yaml` to add additional exporters or processors. The
default pipeline keeps things minimal for Durable Object deployments but can be
extended with logging, metrics pipelines, or tail-based sampling as your
observability footprint grows.

> Tip: When publishing from Arbiter use
> `bun run handlers:publish --template otel-collector --create-r2-bucket` to
> provision the bucket automatically (set `CLOUDFLARE_API_TOKEN` in your
> environment). Configure the default bucket in `.arbiter/config.*` under
> `handlers.cloudflare.r2`.
