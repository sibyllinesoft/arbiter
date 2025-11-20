name: Rust CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Cache cargo
        uses: actions/cache@v3
        with:
          path: |
            ~/.cargo
            target
          key: {{runner_os_expr}}-cargo-{{lockfile_hash}}
          restore-keys: |
            {{runner_os_expr}}-cargo-
      - name: Build
        run: cargo build --verbose
      - name: Format
        run: cargo fmt -- --check
      - name: Lint
        run: cargo clippy -- -D warnings
      - name: Test
        run: cargo test --all --env ENVIRONMENT=test
{{deploy_block}}
