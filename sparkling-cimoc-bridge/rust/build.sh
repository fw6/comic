#!/usr/bin/env bash
# cimoc-core 双端构建：Android .so（JNI 绑定）/ iOS 静态库 XCFramework + Swift 绑定。
# 前置：cargo-ndk 与 uniffi-bindgen 已安装，Android NDK 已安装（路径见下）。
# uniffi-bindgen 安装（本目录 .cargo/config.toml 已覆盖 artifactory 直连 crates.io）：
#   cargo install uniffi --features cli --registry crates-io
set -euo pipefail

# 本机 NDK 路径（可用 ANDROID_NDK_HOME 覆盖）。
export ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-$HOME/Library/Android/sdk/ndk/29.0.14206865}"
export PATH="$HOME/.cargo/bin:$PATH"

BRIDGE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUST_DIR="$BRIDGE_DIR/rust"
cd "$RUST_DIR"

echo "== cargo test =="
cargo test --quiet

echo "== host cdylib（供 uniffi-bindgen 读取元数据，架构无关） =="
cargo build --release

echo "== 生成 Swift 绑定（iOS） =="
mkdir -p "$BRIDGE_DIR/ios/Generated"
rm -f "$BRIDGE_DIR/ios/Generated/"*
uniffi-bindgen generate --language swift \
  --out-dir "$BRIDGE_DIR/ios/Generated" \
  target/release/libcimoc_core.dylib

echo "== Android .so（arm64-v8a + armeabi-v7a） =="
cargo ndk -t arm64-v8a -t armeabi-v7a \
  -o "$BRIDGE_DIR/android/src/main/jniLibs" build --release

echo "== iOS 静态库（真机 + 模拟器 arm64/x86_64） =="
cargo build --target aarch64-apple-ios --release
cargo build --target aarch64-apple-ios-sim --release
cargo build --target x86_64-apple-ios --release

echo "== iOS XCFramework（真机 + fat 模拟器） =="
mkdir -p target/sim
xcrun lipo -create \
  target/aarch64-apple-ios-sim/release/libcimoc_core.a \
  target/x86_64-apple-ios/release/libcimoc_core.a \
  -output target/sim/libcimoc_core.a
rm -rf "$BRIDGE_DIR/ios/CimocCore.xcframework"
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libcimoc_core.a \
  -library target/sim/libcimoc_core.a \
  -output "$BRIDGE_DIR/ios/CimocCore.xcframework"

echo "== 完成 =="
echo "提示：重建 XCFramework 后，若 app 侧 pod install 未重新分析本 pod（slice 名陈旧），"
echo "需删除 Pods/Local Podspecs/Sparkling-Cimoc.podspec.json 后再 pod install。"
