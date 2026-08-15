# 构建环境

## cargo 源

- 本仓库 `.cargo/config.toml` 将 crates-io 重定向到 rsproxy.cn（用户要求：不用内网 artifactory；官方源 403 时用国内镜像）。
- **不要改动**。

## workspace 构建产物

- `desktop/target/` 由 workspace 根生成，成员 crate 的 `/target` 忽略规则覆盖不到——`desktop/.gitignore` 必须包含 `target`。

## 命令

- 命令速查见根 `AGENTS.md`（核心命令一节）。
