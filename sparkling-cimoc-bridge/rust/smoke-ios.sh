#!/usr/bin/env bash
# iOS 运行时冒烟测试：临时注入 rustVersion/crawl 调用 → 构建 bundle → xcodebuild → 装到模拟器 → 校验日志 → 还原源码。
# 验证「JS → Sparkling Method → Swift(uniffi) → Rust 核心（XCFramework）」整条链路。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/sparkling-cimoc"
MAIN="$APP/src/cimoc/screens/Main.tsx"
BUNDLE_ID="com.sparkling.app.SparklingGo"
DEVICE="iPhone 17 Pro"
APP_PATH="/tmp/SparklingGo-dd/Build/Products/Debug-iphonesimulator/SparklingGo.app"

# 0) 启动模拟器
UDID="$(xcrun simctl list devices | grep "$DEVICE (" | head -1 | grep -oE '[0-9A-F-]{36}')"
if ! xcrun simctl list devices | grep "$UDID" | grep -q Booted; then
  echo "== 启动模拟器 =="
  xcrun simctl boot "$UDID" || true
fi

# 1) 临时注入冒烟调用（脚本退出时还原 Main.tsx）
BACKUP="$(mktemp)"
cp "$MAIN" "$BACKUP"
trap 'cp "$BACKUP" "$MAIN"; rm -f "$BACKUP"' EXIT

python3 - "$MAIN" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if "TEMP smoke test" in s:
    raise SystemExit(0)
s = s.replace(
    "import { SourcesScreen } from './Sources.js';",
    "import { SourcesScreen } from './Sources.js';\nimport { crawl, rustVersion } from '../native/bridge.js';",
)
s = s.replace(
    "    const [content, setContent] = useState<'library' | 'sources'>('library');",
    "    const [content, setContent] = useState<'library' | 'sources'>('library');\n\n    // TEMP smoke test\n    useEffect(() => {\n        rustVersion().then((v) => console.error('[rustVersion]', v)).catch((e) => console.error('[rustVersion] error', e));\n        crawl('categories', 'webtoons', '{}').then((j) => console.error('[crawl-webtoons]', j)).catch((e) => console.error('[crawl-webtoons] error', e));\n    }, []);",
    1,
)
open(p, "w").write(s)
PY

# 2) 构建 bundle + 复制到 ios/LynxResources
echo "== 构建 bundle =="
(cd "$APP" && npm run build) >/dev/null

# 3) xcodebuild（重新嵌入新 bundle）
echo "== xcodebuild =="
(cd "$APP/ios" && xcodebuild -workspace SparklingGo.xcworkspace -scheme SparklingGo -configuration Debug \
  -destination "platform=iOS Simulator,name=$DEVICE" -derivedDataPath /tmp/SparklingGo-dd build) >/tmp/ios-smoke-build.log 2>&1

# 4) 安装
xcrun simctl uninstall "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$UDID" "$APP_PATH"

# 5) 启动并捕获 console 输出（Lynx console 走 stderr，需 --console-pty 才能拿到）
CONSOLE_LOG="$(mktemp)"
xcrun simctl launch --console-pty "$UDID" "$BUNDLE_ID" >"$CONSOLE_LOG" 2>&1 &
LPID=$!
sleep 14
kill "$LPID" 2>/dev/null || true

# 校验：两个方法都被原生侧 invoke 且完成（did invokeMethod），证明 JS → Swift(uniffi) → Rust 链路打通。
# 数据本身由 cargo test 与 Android 冒烟（console.log 可见）覆盖；iOS 侧 JS console 默认不可见。
if grep -q "did invokeMethod: spkPipe.call , args: cimoc.rustVersion" "$CONSOLE_LOG"; then
  echo "PASS: cimoc.rustVersion 原生方法完成"
else
  echo "FAIL: 未看到 cimoc.rustVersion 完成"
  grep -iE "rustVersion|crawl|error|crash" "$CONSOLE_LOG" | tail -30 || true
  rm -f "$CONSOLE_LOG"
  exit 1
fi
if grep -q "did invokeMethod: spkPipe.call , args: cimoc.crawl" "$CONSOLE_LOG"; then
  echo "PASS: cimoc.crawl 原生方法完成"
else
  echo "FAIL: 未看到 cimoc.crawl 完成"
  grep -iE "rustVersion|crawl|error|crash" "$CONSOLE_LOG" | tail -30 || true
  rm -f "$CONSOLE_LOG"
  exit 1
fi
rm -f "$CONSOLE_LOG"
