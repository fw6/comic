# 中文免费漫画源调研与新增源选型（2026-08-19）

背景：`/goal 添加更多漫画源（最好是中文漫画源）`。目标是在既有 Copymanga 之外再增免费中文源，
全部按源脚本系统（runtime JS + rquickjs）接入。本文记录选型结论、各候选源的验证状态与被放弃/推迟的理由，
供后续加源复用。

## 结论速览

| 源 | 状态 | 验证情况 |
|---|---|---|
| **咚漫** dongmanmanhua.cn | ✅ 已接入 + 全链路真网验证通过 | 本机（数据中心 IP）搜索/详情/章节/图片全通，无风控 |
| **漫画柜** manhuagui.com | ✅ 已接入；搜索/详情真网验证通过 | 图片链路（p.a.c.k.e.r 解包 → hamreus）需家用网络验证；数据中心 IP 被强反爬（首次可通，随后整站连接被拒） |
| **漫画人** manhuaren.com | ⏸ 推迟 | 搜索/分类/详情头/阅读页图片已实测；**章节列表 DOM 对数据中心 IP 剥离**（详情页无任何章节容器），且开源参考（venera manhuaren.js）用的 `.chapteritem` 在当前 DM5 模板站已不存在——无法构建准确 fixture |
| **包子漫画** baozimh | ✅ 已接入 + 全链路真网验证通过（2026-09-30，隐藏 webview 渲染通道） | 搜索 77 条 / 分类 37 条 / 详情 1187 章 / 章节图片（50 张）全通，正文见 `docs/research/webview-render-channel.md` |
| **开心看漫画** kxmanhua.com | ✅ 已接入 + 全链路真网验证通过（2026-09-30） | 服务端渲染的 PHP 站，无 IP 风控：搜索命中 / 分类「韩漫」24 条 / 详情 5 话 / 首话 262 张图。正文见 `docs/research/kxmanhua-source.md` |
| **鸟鸟韩漫** nnhanman.xyz | ✅ 已接入 + 全链路真网验证通过（2026-09-30，隐藏 webview 渲染通道） | 整站 TLS 连接对数据中心 IP 重置（非内容剥离）：搜索 7 条 / 分类 18 条 / 详情 5 话 / 首话 262 张图。正文见 `docs/research/nnhanman-source.md` |
| **Hentara** hentara.com | ✅ 已接入 + 全链路真网验证通过（2026-09-30） | 英文站，站点自带静态 JSON 数据接口且无 IP 风控：搜索 12 条 / 分类 24 条 / 详情 14 话 / 首话 14 张图。正文见 `docs/research/hentara-source.md` |
| **DM5** dm5.com | ❌ 放弃 | 与 manhuaren 同款 DM5 模板、同被剥离章节列表（详情页仅同类推荐链接） |
| 看漫画/动漫之家/漫画岛/知漫画 | ❌ 已死/不可达 | 调研确认（2026-08-19） |
| 哔哩哔哩漫画 | ❌ | 需登录 + DRM |

## 关键经验

1. **中文漫画站对「数据中心 IP」普遍强反爬**：Copymanga（IP 信誉）、漫画柜（整站 IP 封锁 + 剥离章节页
   图片脚本）、漫画人/DM5（剥离章节列表）各显神通。家用住宅 IP 均正常。因此**本环境无法完成全部源的
   真网 end-to-end 验证**，只能：搜索/列表端点尽量实测 + 用开源参考（tachiyomi/keiyoushi/venera）交叉确认
   结构 + fixture 双轨测试，最后交家用网络跑 `live_smoke` 兜底。
2. **p.a.c.k.e.r 打包脚本是中文漫画站通用隐藏手段**（漫画人/DM5/漫画柜的图片数据都在
   `eval(function(p,a,c,k,e,d){…})` 里）。已在 `manhuagui.js` 实现**无正则解包器**（QuickJS 白名单无
   RegExp，`unpackPacker` 用字符扫描令牌替换），用真实生成的包验证通过——后续加 DM5 等可复用。
3. **可重建 URL 优先于需 Rust 缓存**：咚漫 viewer URL 含不可重建的中文 slug → Rust 缓存；
   漫画柜章节号即 URL 的 cid（可重建）→ 纯脚本侧，Rust 只留请求头。
4. 加源时先探测「目标端点是否对本机 IP 剥离内容」——剥离的源（manhuaren/dm5）无法本机验证，
   只能在有住宅 IP 配合时接入。
5. **「JS 挑战 / 客户端环境校验」型防护的源走隐藏 webview 渲染通道**（2026-09-30 起，见
   `docs/research/webview-render-channel.md`）：不可见 webview 加载页面、等验证自动完成、取回
   渲染后 HTML 走原有 parse 契约。包子漫画按此方案接入并经真网验证；此前因 Cloudflare 放弃的
   候选源可重新评估。纯 IP 信誉封锁（copymanga 详情/漫画柜）不受影响，这类源仍看住宅 IP。

## 新增源清单（本次）

- 咚漫：`docs/research/dongman-source.md`
- 漫画柜：`docs/research/manhuagui-source.md`
- Copymanga（上一批）：`docs/research/copymanga-source.md`

## 新增源清单（2026-09-30 批次）

- 鸟鸟韩漫：`docs/research/nnhanman-source.md`
- 开心看漫画：`docs/research/kxmanhua-source.md`
- Hentara：`docs/research/hentara-source.md`

本批次的三条经验：

1. **TLS 连接重置也是渲染通道的适用场景**。鸟鸟韩漫在握手阶段就重置连接（curl 与 reqwest 都拿不到
   任何响应），渲染通道照样能取到页面——不需要「JS 挑战」这个前提。
2. **站点自带的数据接口优先**。Hentara 的 Vite SPA 从 `cdn.hentara.com/data/*.json` 取全站数据，
   脚本直接用这套接口（详情/章节是纯 JSON），比解析预渲染 HTML 稳。站内搜索是前端在目录 JSON 上
   过滤，服务端 `/browse?search=` 不过滤——脚本照前端的行为做。
3. **状态字段的判读范围要限定**。开心看漫画的「连载/完结」在列表卡片、详情封面区、侧栏推荐三处都出现，
   整页搜 `epgreen` 会把别的漫画的完结态算到当前作品头上；判读要限定在封面区片段内。

## Backlog（后续加源候选）

- **漫画人**（+DM5，同款模板）：需有家用网络的人抓一份详情页完整 HTML（含章节列表容器），确认当前
  章节 DOM（脚本 `#chapterList_{id}` / `.chapters` 结构，见 manhuaren.com 详情页加载的 `script.js`），
  再按 `/m{cid}/` 章节链接实现。阅读页图片解包逻辑已具备（manhuagui.js 的 `unpackPacker` 通用）。
- **漫画柜镜像**：webmota/kukuc/twmanga/dinnerku 等（镜像列表维护成本高，正站可用时不优先）。
- **快看漫画**：`api.kkmh.com` 搜索 + Nuxt 内嵌图片 payload，app API，复杂度较高。
