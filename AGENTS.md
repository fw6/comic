# AGENTS.md

You are an expert in JavaScript, Rspeedy, and Lynx application development. You write maintainable, performant, and accessible code.

## Repository Layout

- `sparkling-cimoc/` — **当前主工程**：Cimoc 漫画阅读器，基于 TikTok Sparkling（Brownfield Lynx 容器）+ Rspeedy。工作流统一走官方 `sparkling-app-cli`（dev/build/autolink/run:android/run:ios）。
- `sparkling-cimoc-bridge/` — **Sparkling Method 包**：16 个原生桥方法（network/storage/download/local/webdav），含 codegen 桩、Android 实现、iOS not-implemented 桩、JS 门面。被 app 以 `file:../sparkling-cimoc-bridge` 依赖。
- 根目录 `src/`、`android/`、`dist/` — 迁移前的旧 Lynx 工程（rspeedy 直连 + 自建 Android 壳），**已废弃**（见提交 "migrate to Sparkling, abandon self-built Android host"），不要在其上改动。CI（`.github/workflows/release.yml`）构建 `sparkling-cimoc/`。

## Read in Advance

- Sparkling: [llms.txt](https://tiktok.github.io/sparkling/llms.txt)，**REQUIRED**。处理 Sparkling/方法包任务前必须阅读（文档入口）。
- Lynx: [llms.txt](https://lynxjs.org/next/llms.txt)，**REQUIRED**。
- 方法包参考实现：直接读 `sparkling-cimoc/node_modules/sparkling-navigation`、`sparkling-cimoc-bridge/node_modules/sparkling-method` 源码（官方 IDL 模式）。

## Commands

App（在 `sparkling-cimoc/` 下执行）：

- `npm run dev` - Start the dev server (port 5969)
- `npm run build` - `sparkling-app-cli build --copy`，产物复制到 android assets 与 ios/LynxResources
- `npm run autolink` - 扫描方法包，写 settings.gradle.kts / app build.gradle.kts / Podfile / SparklingAutolink
- `npm test` - vitest 单元测试
- `npx tsc --noEmit` - 类型检查（tsconfig 用 `moduleResolution: Bundler`）
- `cd android && ./gradlew assembleDebug` - 打 debug APK

方法包（在 `sparkling-cimoc-bridge/` 下执行）：

- `npm run codegen` - `sparkling-method-cli codegen`，从 `src/**/*.d.ts` 生成 Android/iOS 桩与 metadata
- `npm run build` - `tsc -p tsconfig.json`（仅编译入口 index.ts）

## Known Gotchas（坑）

1. **codegen 产物不可全信**：`sparkling-method-cli codegen` 生成的逐方法 TS 实现（丢弃 data、`const errorResponse: = {` 类型残缺）与 Swift IDL（非可选属性无默认值，编译不过）均不可用。JS 门面（index.ts）与 iOS 桩需手写，只复用生成的 `.d.ts` 类型。重跑 codegen 会覆盖 index.ts。
2. **autolink 类名约定**：`sparkling-app-cli autolink` 按 `androidPackageName.<camelCase方法名>.Cimoc<Name>Method` 推断实现类 FQN（methods 配置键 + `className: CimocMethod`）。codegen 桩在 `...cimoc.cimoc.<lowercase>` 包。**实现类必须放 camelCase 包目录**（`getText/` 而非 `gettext/`），否则 `Class.forName` 失败、方法静默不注册。
3. **createXModel 调用**：必须用官方 receiver 语法 `X::class.java.createXModel()`；`createXModel(X::class.java)` 函数式调用在 Kotlin 1.8 下解析歧义（receiver type mismatch）。
4. **tsconfig**：必须 `moduleResolution: Bundler`；node16 无法解析 `./x.d` 类型引用与 sparkling-method 的 default 导入。
5. **sparkling-method 版本**：`.d.ts` codegen 需 `sparkling-method-cli@2.1.0-rc.36`（npm `@latest` 是旧版 2.0.1，不支持该 codegen）。
6. **Fresco 图片**：Webtoons CDN（pstatic.net）热链保护，需 okhttp interceptor 补 `Referer`；16KB 页设备需 `MemoryChunkType.BUFFER_MEMORY`（绕开未对齐的 libimagepipeline.so）。
7. **不要自定义壳/构建**：app 的 android/ios 壳与打包统一走官方 `sparkling-app-cli`，勿手写替代流程（用户明确要求对齐 sparkling-app-template 模型）。

## Related Docs

- Rsbuild: <https://rsbuild.rs/llms.txt>

- Rspack: <https://rspack.rs/llms.txt>

## Tools

### Biome

- Run `npm run lint` to lint your code
- Run `npm run format` to format your code

