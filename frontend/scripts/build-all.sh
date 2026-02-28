#!/bin/bash
# 完整构建脚本: 先构建 windsurf_chat CLI，复制到指定位置，再构建主应用
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================"
echo "  Stop 完整构建脚本"
echo "  项目目录: $PROJECT_ROOT"
echo "========================================"

# ── 步骤 1: 构建 windsurf_chat CLI (Universal Binary for macOS) ──
echo ""
echo "[1/5] 构建 windsurf_chat CLI (Intel x86_64)..."
cargo build --release \
  --manifest-path "$PROJECT_ROOT/windsurf_chat/Cargo.toml" \
  --target x86_64-apple-darwin

echo ""
echo "[2/5] 构建 windsurf_chat CLI (Apple Silicon aarch64)..."
cargo build --release \
  --manifest-path "$PROJECT_ROOT/windsurf_chat/Cargo.toml" \
  --target aarch64-apple-darwin

echo ""
echo "[3/5] 合并为 Universal Binary..."
UNIVERSAL_DIR="$PROJECT_ROOT/windsurf_chat/target/universal-apple-darwin/release"
mkdir -p "$UNIVERSAL_DIR"
lipo -create \
  "$PROJECT_ROOT/windsurf_chat/target/x86_64-apple-darwin/release/windsurf_chat" \
  "$PROJECT_ROOT/windsurf_chat/target/aarch64-apple-darwin/release/windsurf_chat" \
  -output "$UNIVERSAL_DIR/windsurf_chat"
echo "  Universal binary 已生成: $UNIVERSAL_DIR/windsurf_chat"

# ── 步骤 2: 复制到 src-tauri/binaries ──
echo ""
echo "[4/5] 复制 CLI 到 src-tauri/binaries..."
BIN_DIR="$PROJECT_ROOT/src-tauri/binaries"
mkdir -p "$BIN_DIR"

# 复制为 tauri sidecar 需要的命名格式
cp "$UNIVERSAL_DIR/windsurf_chat" "$BIN_DIR/windsurf_chat-universal-apple-darwin"
cp "$UNIVERSAL_DIR/windsurf_chat" "$BIN_DIR/windsurf_chat"

# 同时复制到 /Volumes/StopRules (RAM Disk，如果存在)
if [ -d "/Volumes/StopRules" ]; then
  cp "$UNIVERSAL_DIR/windsurf_chat" "/Volumes/StopRules/windsurf_chat"
  echo "  已同步到 RAM Disk: /Volumes/StopRules/windsurf_chat"
fi

echo "  已复制到:"
echo "    $BIN_DIR/windsurf_chat-universal-apple-darwin"
echo "    $BIN_DIR/windsurf_chat"

# ── 步骤 3: 构建主 Tauri 应用 ──
echo ""
echo "[5/5] 构建 Tauri 主应用 (Universal)..."
cd "$PROJECT_ROOT"
npx tauri build --target universal-apple-darwin

echo ""
echo "========================================"
echo "  构建完成!"
echo "========================================"
