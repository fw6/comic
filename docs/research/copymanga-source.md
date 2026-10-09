# Copymanga 拷贝漫画 源 — 实现状态与验证/发布指南（2026-08-18）

## 状态

Copymanga（拷贝漫画）已作为内置源接入源脚本系统，提交于：

- `911f9ee` 功能实现（源脚本 / Rust 接线 / 前端接入 / 5 fixture / 双轨测试）
- `fc1e724` Rust 网络层本地 mock 集成测试
- `68c5bac` 可诊断 live 冒烟测试

实现文件：
- `desktop/crates/mojuan-core/src/js/sources/copymanga.js` — 源脚本（buildUrl/parse，五 op）
- `desktop/crates/mojuan-core/src/crawler/copymanga.rs` — 请求头、章节 feed（group/default）、chapter uuid 缓存
- `desktop/crates/mojuan-core/src/crawler/mod.rs`、`script.rs`、`js/sources.rs` — 分派/ctx/内置
- `desktop/src/screens/Sources.tsx`、`src/lib/storage.ts` — 书源 tab、SOURCE_NAMES、initSources 合并新内置源

测试：cargo test 55 项（含 2 个本地 mock 集成测试）、vitest 82 项、tsc 0，全绿；真网冒烟 `copymanga_live_search` 通过。

## 真网验证（待在家用网络执行）

```bash
cd desktop
cargo test -p mojuan-core --test live_smoke -- --ignored copymanga_live_detail_and_images
```

覆盖 detail → 章节 → 图片全链路。**预期**：打印 `copymanga detail: N 章；首章 M 张图` 并通过。

**若失败**：测试的 panic 消息会打印 mojuan-core 记录到的源错误。区分两类原因：
- 错误含 `fetch(detail): HTTP ...` 或 detail 为空且消息提示被风控 —— Copymanga IP 级风控拦截（comic2 返回 `results:null` 或 `code 210`「检测到破解版 APP，等待1小时自动解除」）。**只影响数据中心/被标记 IP**，家用住宅 IP 不受此封锁。
- 其他错误 —— 按 panic 消息排查，可能是解析/字段问题，回报即可。

> 注意：本仓库开发机公网 IP 为数据中心段（如 103.158.14.153），被 Copymanga 风控；家用网络不受影响。本实现无法从该环境验证 detail 真网链路，仅能离线（fixture + mock）与交叉验证（两个开源 copymanga 下载器）保证结构正确。

## 发布到 fw6/mojuan-sources（待用户决定）

copymanga 为内置源（随 app 打包，无需发布即可使用）。若要让**已装用户**经设置「检查更新」获取，需在 `fw6/mojuan-sources` 的 `sources.json` 加条目（与 webtoons/mangadex 同结构）：

```json
"copymanga": {
  "name": "Copymanga",
  "version": 1,
  "sha256": "9c20a548ed8b20585fd6b43d109136512e1eec33395dc949b2d21d1e8cb7c6ad",
  "script": "<desktop/crates/mojuan-core/src/js/sources/copymanga.js 全文>"
}
```

发布前建议先在家用网络跑通上面的真网验证。

## 维护注意

- **API 域名轮换**：Copymanga 域名频繁更换（曾用 mangacopy.com / copy3000.com / copymanga.site 等）。当前默认 `https://api.mangacopy.com`（源自官网 www.mangacopy.com，搜索/列表/分类已实测）。域名失效时改两处常量即可：`copymanga.js` 顶部 `API` 与 `crawler/copymanga.rs` 的 `API`。
- **请求头配方**：`platform: 3` / `version: 3.0.0` / `hc-lang: zh-hans` 为本主机所需（缺省或 platform=1+Chrome UA 返回空/210）。`version` 若被要求升级，更新该常量。
- **章节上限**：feed 单次 `limit=1000`（超长连载截断；开源下载器同样限 500）。取默认「正序」翻译组（group=default），多翻译组漫画仅正序组。
- **风控**：detail/章节/图片端点对数据中心 IP 有信誉封锁（临时，1 小时自动解除）。家用住宅 IP 正常。
