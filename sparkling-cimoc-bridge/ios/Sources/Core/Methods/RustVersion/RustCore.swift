// Cimoc 方法包对 Rust 核心（cimoc-core）的 Swift 封装。
// uniffi 生成的绑定以顶层函数形式暴露（cimocVersion / crawl / uniffiEnsureCimocCoreInitialized）。
import Foundation

enum RustCore {
    static func version() -> String {
        uniffiEnsureCimocCoreInitialized()
        return cimocVersion()
    }

    /// 与顶层 uniffi `crawl(op:source:payload:)` 用不同方法名区分，避免成员名遮蔽全局函数。
    static func invokeCrawl(op: String, sourceId: String, payload: String) -> String {
        uniffiEnsureCimocCoreInitialized()
        return crawl(op: op, source: sourceId, payload: payload)
    }
}
