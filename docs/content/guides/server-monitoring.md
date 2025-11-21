# Server Monitoring & Error Handling

This page explains how Arbiter’s API server looks after itself in production and what you can do to keep it healthy. It’s written for operators and integrators—no internal class names required.

## What you get out of the box
- **Automatic health logging** (every ~30s): uptime, memory, CPU, and error counts are written to the server log so you can spot trends.
- **Protective guards**: timeouts around WebSocket auth and message handling, payload size limits, and safe JSON parsing to prevent noisy clients from taking the service down.
- **Failure hygiene**: uncaught exceptions and unhandled promise rejections are logged and trigger a graceful shutdown if they pile up, so you restart clean instead of limping along.
- **Startup resilience**: a few retry attempts with backoff when the server boots, to ride out transient issues like slow dependencies.

## How to monitor it
1) **Built-in logs (always on)**  
   Tail your server log to see periodic health entries and any structured error reports:
   ```bash
   tail -f logs/server.log | grep -E "📊|ERROR|WARN"
   ```

2) **Lightweight watchdog script**  
   If you want an outside-in check, run the bundled script:
   ```bash
   ./scripts/monitor-server.sh        # defaults to 30s intervals
   ./scripts/monitor-server.sh 5      # faster checks
   ```
   It pings `/health`, exercises the WebSocket upgrade path, tracks process CPU/memory, and writes status to `/tmp/arbiter-monitor.log`.

3) **Hook into your observability stack**  
   - Ship the server log to your log pipeline (CloudWatch, ELK, Datadog, etc.).  
   - Add metric scrapes for process RSS/heap and restart counts if you run under a supervisor (systemd/PM2/Kubernetes).  
   - Alert on consecutive health check failures, rising heap usage, or repeated restarts.

## Default thresholds (you can adapt to your environment)
- Heap warning around 500 MB.
- Graceful shutdown after several uncaught errors/rejections (to avoid corrupt state).
- WebSocket timeouts: ~5s for auth, ~10s for message handling.

If your workloads are larger, raise the memory alert in your monitoring layer; the server behavior is safe but conservative.

## What to do when something looks off
1) Check the recent health entries for rising memory or error counts.  
2) Look for bursts of uncaught exceptions/unhandled rejections—these are logged with stack traces.  
3) Review `/tmp/arbiter-monitor.log` if you’re running the watchdog; it records failed health checks and WebSocket probes.  
4) Restart the process once you’ve captured logs; the guards are designed to make restarts predictable and fast.

## Running in different environments
- **Kubernetes**: point your probes at `/health`; expose logs to your aggregator; let your pod restart policy handle clean restarts.
- **VM/container with a supervisor**: use systemd/PM2/Nodemon with restart-on-failure; keep the watchdog script running as a sidecar/cron if you want external verification.
- **Local/dev**: the same safeguards are active; you’ll just see them in your terminal logs.

## Quick start checklist
- Keep `logs/server.log` (or your redirected equivalent) shipping to your log system.
- Optional: enable `scripts/monitor-server.sh` on hosts where the API runs.
- Add alerts for: repeated health check failures, sustained heap growth, frequent restarts, or spikes in uncaught errors.
- Document how to restart the service in your runbook; Arbiter’s shutdown path is already graceful.

With these defaults, you get sensible protection out of the box, and a minimal set of steps to plug Arbiter into your existing monitoring and incident response flow.***
