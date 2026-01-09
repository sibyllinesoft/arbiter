# Justfile for {{ service_name }}

# Show available commands
default:
    @just --list

# Run the application in development mode
dev:
    cargo watch -x run

# Build the application
build:
    cargo build --release

# Run tests
test:
    cargo test

# Run tests with coverage
test-coverage:
    cargo tarpaulin --out html

# Check code without building
check:
    cargo check

# Run clippy lints
lint:
    cargo clippy -- -D warnings

# Format code
fmt:
    cargo fmt

# Fix code formatting and lints
fix:
    cargo fix --allow-dirty --allow-staged
    cargo fmt

# Clean build artifacts
clean:
    cargo clean

# Install development dependencies
install-dev:
    cargo install cargo-watch cargo-tarpaulin

{{ database_block }}

{{ docker_block }}

# Run all checks (format, lint, test)
ci: fmt lint test

# Prepare for commit
pre-commit: fix test
