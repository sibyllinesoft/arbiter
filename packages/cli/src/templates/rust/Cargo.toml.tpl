[package]
name = "{{package_name}}"
version = "0.1.0"
edition = "2021"
description = "{{description}}"

[dependencies]
{{dependencies}}

[dev-dependencies]
tower-test = "0.4"
hyper = { version = "1.0", features = ["full"] }
{{tokio_test}}

[[bin]]
name = "{{bin_name}}"
path = "src/main.rs"

[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
