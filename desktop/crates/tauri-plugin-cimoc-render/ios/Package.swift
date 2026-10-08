// swift-tools-version:5.3
// cimoc 移动端隐藏 webview 渲染通道（iOS 侧，包定义）。

import PackageDescription

let package = Package(
  name: "tauri-plugin-cimoc-render",
  platforms: [
    .macOS(.v10_13),
    .iOS(.v13),
  ],
  products: [
    .library(
      name: "tauri-plugin-cimoc-render",
      type: .static,
      targets: ["tauri-plugin-cimoc-render"])
  ],
  dependencies: [
    .package(name: "Tauri", path: "../.tauri/tauri-api")
  ],
  targets: [
    .target(
      name: "tauri-plugin-cimoc-render",
      dependencies: [
        .byName(name: "Tauri")
      ],
      path: "Sources")
  ]
)
