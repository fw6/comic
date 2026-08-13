# ADR-0001: 保留聚合的 useAppStore hook（不拆分为按切片 hooks）

- 状态：Accepted
- 日期：2026-08-13

## Context

架构审查候选③提出：`store.ts` 的 `useAppStore()` 返回约 23 个成员的 `AppStore` 接口，
接口过大，建议拆成按切片的小 hook（`useFavorites` / `useHistory` / `useSettings` …）。

## Decision

拒绝拆分，保留聚合 hook。

## Rationale

- **多页导航已把状态按容器隔离**：每个屏幕是独立 Lynx 容器 + 独立 JS runtime，jotai
  原子不跨容器共享（跨容器状态走 storage，`hydrateAppState` 每页挂载恢复）。18 个
  `useAppStore()` 消费点里，只有 `main` 容器内的 3 个组件共享同一份 store；其余屏幕
  各自一个 store，不存在跨容器的界面耦合。
- **删除测试**：拆分会把「订阅哪些 atom + 怎么 persist」的决策铺到每个屏幕里——尤其
  Library/Backup/Detail 三个重度消费者（6–10 个切片）要连调多个 hook，复杂度被移动
  而非浓缩。
- **局部性**：`useAppStore` 是「atom + persist」的汇聚点；新增一个持久化切片只需改这一处
  + service 层 accessor。接口虽大但内聚。
- 残余仅是 `main` 容器内 3 个组件的过度订阅（任意 atom 变更触发重渲染），属微性能，非架构问题。

## Consequences

- 未来架构审查不应再次建议拆分 `useAppStore`。
- 若 `main` 容器出现可测量的重渲染性能问题，再重新打开；届时用 `useAtomValue` 按切片
  细粒度订阅（不拆 hook），而非按切片拆接口。
