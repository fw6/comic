# AGENTS.md

墨卷漫画阅读器桌面版 — Tauri v2（Rust 后端）+ React（Vite web 前端）跨平台桌面应用；Rust 核心 `desktop/crates/mojuan-core/` 跨端共享。旧 Lynx 工程已删除（迁移轨迹见 [wayfinder 地图](https://github.com/fw6/mojuan/issues/2)）。

## 核心命令（在 `desktop/` 下执行）

- `npm run tauri dev` — 开发模式（Vite HMR；改 Rust 触发后端重编，比前端慢）
- `npm run tauri build` — 打包桌面应用
- `npm run build` — 前端构建（`tsc && vite build`）
- `npx tsc --noEmit` — 仅类型检查
- `cargo test` / `cargo check` — Rust workspace（mojuan-core + src-tauri）

## 约定（渐进式披露，按需阅读）

- [Tauri / 桌面开发](docs/agents/tauri-development.md) — 处理任何 Tauri 任务前**必读** Tauri llms.txt；前端 HMR 工作流；图片加载 scheme 代理；同步命令/主线程坑
- [前端 desktop/src](docs/agents/frontend.md) — Tailwind v4 + beui 组件（`scripts/fetch-beui.mjs` 拉取）、设计令牌位置、断点约定、阅读器分页策略、不用截图验证界面的方法
- [Rust 核心 mojuan-core](docs/agents/mojuan-core.md) — 架构、运行时源脚本契约、命令 API 约定（`&str` → JSON）、测试
- [构建环境](docs/agents/build-environment.md) — cargo 源（勿改）、workspace target/gitignore
- [工程原则与优先级](docs/agents/principles.md) — 全局原则（`~/.zcode/AGENTS.md`）+ 冲突裁决（长期演进优先）

## 资源

- [docs/](docs/) — wayfinder 决策地图、研究纪要（`docs/research/`）、ADR、issue 追踪约定（`docs/agents/issue-tracker.md`）
- [GLOSSARY.md](GLOSSARY.md) — 领域术语表（无限滚动、外链章节过滤、进度自动记录等）
- [PRODUCT.md](PRODUCT.md) / [DESIGN.md](DESIGN.md) — 产品事实与视觉设计系统（配色/字体/组件规范）
