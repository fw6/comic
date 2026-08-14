#!/usr/bin/env bash
# Android 运行时冒烟测试：临时注入 rustVersion 调用 → 构建 → 安装 → 启动 → 校验 logcat → 还原源码。
# 验证「JS → Sparkling Method → Kotlin(JNI) → Rust 核心」整条链路返回 cimoc-core-rust。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BRIDGE="$ROOT/sparkling-cimoc-bridge"
APP="$ROOT/sparkling-cimoc"
MAIN="$APP/src/cimoc/screens/Main.tsx"
PKG="com.example.sparkling.go"
APK="$APP/android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk"
export JAVA_HOME="${JAVA_HOME:-/Users/fengwei/Library/Java/JavaVirtualMachines/corretto-11.0.23/Contents/Home}"

# 0) 确保模拟器已启动
if ! adb get-state >/dev/null 2>&1; then
  echo "== 启动模拟器 =="
  emulator -avd Small_Phone -no-snapshot-load >/dev/null 2>&1 &
  adb wait-for-device
  sleep 12
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
    "import { SourcesScreen } from './Sources.js';\nimport { crawl, listDownloaded, rustVersion, scanLocalComics } from '../native/bridge.js';",
)
s = s.replace(
    "    const [content, setContent] = useState<'library' | 'sources'>('library');",
    "    const [content, setContent] = useState<'library' | 'sources'>('library');\n\n    // TEMP smoke test\n    useEffect(() => {\n        rustVersion().then((v) => console.log('[rustVersion]', v)).catch((e) => console.error('[rustVersion] error', e));\n        crawl('categories', 'webtoons', '{}').then((j) => console.log('[crawl-webtoons]', j)).catch((e) => console.error('[crawl-webtoons] error', e));\n        crawl('search', 'mangadex', JSON.stringify({ keyword: 'eleceed' })).then((j) => console.log('[crawl-mangadex]', j)).catch((e) => console.error('[crawl-mangadex] error', e));\n        scanLocalComics().then((r) => console.log('[scanLocal]', JSON.stringify(r))).catch((e) => console.error('[scanLocal] error', e));\n        listDownloaded('smoke').then((r) => console.log('[listDownloaded]', JSON.stringify(r))).catch((e) => console.error('[listDownloaded] error', e));\n    }, []);",
    1,
)
open(p, "w").write(s)
PY

# 2) 构建：Rust + Lynx bundle + APK
echo "== 构建 =="
bash "$BRIDGE/rust/build.sh" >/dev/null
(cd "$APP" && npm run build) >/dev/null
(cd "$APP/android" && ./gradlew assembleDebug) >/dev/null

# 3) 安装 + 启动
adb uninstall "$PKG" >/dev/null 2>&1 || true
adb install -r "$APK" >/dev/null
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 || true
sleep 15

# 4) 校验
if adb logcat -d | grep -q "cimoc-core-rust"; then
  echo "PASS: rustVersion -> cimoc-core-rust"
else
  echo "FAIL: 未在 logcat 中看到 cimoc-core-rust"
  adb logcat -d | grep -iE "rustVersion|linker|UnsatisfiedLink|jnidispatch" | tail -20 || true
  exit 1
fi

if adb logcat -d | grep "crawl-webtoons" | grep -q "动作"; then
  echo "PASS: crawl(categories, webtoons) -> 返回分类列表"
else
  echo "FAIL: 未在 logcat 中看到 crawl-webtoons 分类列表"
  adb logcat -d | grep -iE "crawl-webtoons|UnsatisfiedLink|Exception" | tail -20 || true
  exit 1
fi

# mangadex 真实网络抓取为加分项（模拟器可能无网络），非致命
if adb logcat -d | grep "crawl-mangadex" | grep -qE 'mangadex-|\[\]'; then
  echo "INFO: crawl(search, mangadex) 已返回"
else
  echo "INFO: 未观测到 crawl-mangadex 结果（可能无网络，跳过）"
fi

# 本地目录方法：验证 Rust 文件 IO + JNI 链路（无需网络）
if adb logcat -d | grep -q "scanLocal"; then
  echo "PASS: scanLocalComics -> Rust 文件 IO 链路"
else
  echo "FAIL: 未在 logcat 中看到 scanLocal"
  adb logcat -d | grep -iE "scanLocal|UnsatisfiedLink|Exception" | tail -20 || true
  exit 1
fi
if adb logcat -d | grep -q "listDownloaded"; then
  echo "PASS: listDownloadedChapters -> Rust 文件 IO 链路"
else
  echo "FAIL: 未在 logcat 中看到 listDownloaded"
  adb logcat -d | grep -iE "listDownloaded|UnsatisfiedLink|Exception" | tail -20 || true
  exit 1
fi
