# Cimoc · Sparkling

使用 **Sparkling**（TikTok 跨端容器框架，底层 Lynx）+ **React** 100% 复刻的在线漫画阅读器 [Cimoc](https://github.com/Haleydu/Cimoc)。

> **2026-08 迁移**：应用已从「自建 Android 宿主」迁移到官方 Sparkling 脚手架（`sparkling-cimoc/`）。
> Sparkling 提供官方原生 Shell、多页面容器、CLI 与 Debug Panel，替代原先手写的 LynxView 宿主；
> 原自建宿主代码（根目录 `src/`、`android/`）保留作历史参考，不再维护。

本项目以 Material Design 视觉风格和交互方式忠实还原 Cimoc 的界面与功能结构，**数据层为真实图源链路**（Webtoons），在非原生环境（web/测试）自动回退到 mock 数据。

## Sparkling 版（sparkling-cimoc/）

```bash
cd sparkling-cimoc
npm run build        # sparkling-app-cli build：构建 Lynx bundle + 拷贝到原生 assets
npm run run:android  # 构建 bundle + 安装 Android debug 包并启动
```

- 页面入口：`sparkling-cimoc/src/pages/main/`（渲染 Cimoc 应用）
- 应用源码：`sparkling-cimoc/src/cimoc/`（App / 17 屏 / jotai store / Webtoons 数据层 / 原生桥）
- 原生桥：5 个 Lynx Module（Network/Storage/Download/Local/WebDAV）接入 Sparkling 壳并在 `SparklingApplication` 注册
- 已验证（真机）：主屏网格/页签/抽屉/详情/返回交互正常；原生桥可用；真实 Webtoons 搜索链路返回真实结果（Eleceed）

## 真实数据链路

- **真实图源解析**（`src/data/webtoons.ts`）：抓取 Webtoons 公开页面解析搜索、分类、详情、章节与图片 URL（HTML 解析，无需登录）。
- **原生桥**（`src/native/bridge.ts` + Android 宿主 Kotlin 模块）：
  - `NetworkModule` — okhttp HTTP GET（图源抓取）
  - `StorageModule` — 收藏/历史/设置/标签/下载 JSON 持久化
  - `DownloadModule` — 章节图片真实下载到应用私有目录
  - `LocalModule` — SAF 文件夹选择 + 本地漫画扫描（本地标签页）
  - `WebDavModule` — WebDAV 云备份/恢复（备份页）
- **数据服务层**（`src/data/service.ts`）：统一异步数据访问，搜索/分类/详情/章节/图片全部走真实图源；收藏/历史/设置/标签/下载通过原生桥持久化并在启动时恢复。

## 功能

- **主界面 · 漫画**：Material 导航抽屉（漫画 / 图源 / 日间·夜间 / 备份 / 设置 / 关于），抽屉头部展示最近阅读漫画。
- **四大标签页**：历史 / 收藏 / 下载 / 本地，3 列封面网格 + 每页独立 FAB。
  - 长按漫画弹出 **信息弹窗**（标题 / 图源 / 状态 / 当前章节 / 最后阅读时间），按标签页提供删除 / 取消收藏操作。
  - 收藏页支持 **标签 / 状态筛选**（全部 / 完结 / 连载 / 自定义标签），历史页 FAB 一键清空，下载页 FAB 暂停 / 继续。
- **图源**：2 列网格，可开关图源；点击进入该图源的 **分类浏览**（Category），长按查看图源详情；工具栏含搜索 / 全选 / 反选 / 清空。
- **搜索**：关键词搜索 + 严格搜索 + **图源多选过滤**（工具栏"图源"）+ 热门搜索建议。
- **漫画详情**：封面 / 作者 / 简介 / 状态 / 更新时间头部，3 列章节网格（含已下载标记），收藏 / 继续阅读双 FAB，长按头部弹简介；工具栏含**下载 / 编辑标签 / 搜索标题 / 搜索作者 / 分享漫画 / 反转列表**。
- **编辑标签（TagEditor）**：预设标签 + 自定义标签，收藏页按标签筛选。
- **阅读器**：翻页模式（Swiper）与卷纸模式（滚动），黑色背景 + 半透明 HUD（章节 / 页码 / **时钟**信息块 + 进度滑条），点按切换 HUD、左右区域翻章，进入自动记录阅读历史。
- **阅读配置**：翻页 / 卷纸双页签 + **自定义点击 / 长按事件**（3×3 区域映射 14 种事件）。
- **已下载列表（Task）**：下载漫画的离线章节列表，点击直接阅读。
- **设置**：阅读 / 下载 / 搜索 / 应用四组设置，含**启动画面选择、存储位置、清除缓存**；主题 6 色 + 夜间遮罩透明度。
- **备份 / 关于**：收藏 / 标签 / 设置三项备份与恢复；应用介绍与许可信息。
- **主题系统**：6 种强调色（天蓝 / 蓝灰 / 青绿 / 紫色 / 粉色 / 棕色）+ 可调透明度的夜间遮罩。
- 状态管理使用 **jotai**（`src/store.ts`）。

## 快速开始

```bash
npm install
npm run dev        # 启动开发服务器，扫描二维码预览
npm run build      # 生产构建
npm test           # 运行测试
npm run check      # Biome 代码检查
```

## Android APK 构建

项目自带 `android/` 原生宿主工程（基于官方 [integrating-lynx-demo-projects](https://github.com/lynx-family/integrating-lynx-demo-projects) 精简），将 Lynx bundle 打包进独立可安装的 APK。

```bash
npm run apk:build    # 构建 Lynx bundle → 同步到 android assets → gradle 打 Debug APK
```

产物位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

连接已开启 USB 调试的真机（或启动模拟器）后：

```bash
npm run apk:install  # adb 安装
```

前提：`ANDROID_HOME` 指向 Android SDK（本机为 `~/Library/Android/sdk`），`android/gradlew` 会自动下载所需的 Gradle 8.7。

## GitHub Actions 发布

`.github/workflows/release.yml` 在 CI 上完成「构建 → 测试 → 打 APK → 发布」全流程：

- **触发方式**
  - 推送 `v*` 标签（如 `v1.0.0`）：构建完成后自动创建 GitHub Release，并附上 Debug APK 作为下载资产；
  - 手动触发（Actions 页面的 *Run workflow*）：仅构建并上传 APK 为 workflow artifact，不创建 Release。
- **构建内容**：Node 22 安装依赖并跑测试 → 构建 Lynx bundle → 同步到 Android assets → JDK 17 + Android SDK 34 执行 `./gradlew assembleDebug`。
- **产物**：`Cimoc-<版本>.apk`（如 `Cimoc-v1.0.0.apk`），发布在对应 tag 的 Release 页面。

发布一个版本：

```bash
git tag v1.0.0
git push origin v1.0.0
```

> 说明：当前发布的是 Debug APK（与本地 `npm run apk:build` 产物一致）。如需正式签名包，可在 `android/app/build.gradle.kts` 中配置 `signingConfigs`，并通过 GitHub Secrets 注入 keystore 后在 workflow 中增加 `assembleRelease` 步骤。

## 目录结构

```
src/
  App.tsx          应用入口 + 路由 + 夜间遮罩
  store.ts         jotai 状态（设置、主题、收藏、历史）
  theme/           6 套主题与夜间遮罩
  data/            领域模型与 mock 数据
  nav/             屏幕栈路由
  components/      通用组件（顶栏、FAB、漫画卡片）
  screens/         全部界面
```
