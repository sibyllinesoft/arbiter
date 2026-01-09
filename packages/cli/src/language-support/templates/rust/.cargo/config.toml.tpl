[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

[build]
rustc-wrapper = "sccache"

[registries.crates-io]
protocol = "sparse"

{{ release_profile }}
