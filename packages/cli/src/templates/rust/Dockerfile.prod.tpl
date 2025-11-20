# Production multi-stage build with distroless
FROM rust:1.70 as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm src/main.rs

# Copy source code
COPY src ./src

# Build application with optimizations
RUN touch src/main.rs && cargo build --release

# Final stage with distroless
FROM gcr.io/distroless/cc-debian12

# Copy the binary from builder stage
COPY --from=builder /app/target/release/app /app

EXPOSE 3000

USER nonroot:nonroot

ENTRYPOINT ["/app"]
