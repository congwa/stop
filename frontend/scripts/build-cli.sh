#!/bin/bash
# Build windsurf_chat CLI for macOS/Linux
set -e
cd "$(dirname "$0")/.."
cargo build --release --manifest-path windsurf_chat/Cargo.toml
mkdir -p src-tauri/binaries
TARGET=$(rustc -Vv | grep host | cut -d' ' -f2)
cp windsurf_chat/target/release/windsurf_chat "src-tauri/binaries/windsurf_chat-$TARGET"
echo "Built windsurf_chat for $TARGET"
