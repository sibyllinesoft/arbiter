name: Rust Application CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  CARGO_TERM_COLOR: always

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cache cargo registry
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
          restore-keys: |
            ${{ runner.os }}-cargo-

      - name: Install SQLx CLI (optional)
        run: cargo install sqlx-cli --no-default-features --features postgres

      - name: Run tests
        run: cargo test --all-features

      - name: Lint
        run: cargo clippy --all-targets --all-features -- -D warnings

      - name: Format check
        run: cargo fmt -- --check

      - name: Build Docker image
        run: |
          docker build -f Dockerfile -t your-registry/app:${{ github.sha }} .
      - name: Push Docker image
        run: echo "Add docker push when registry credentials are configured"
