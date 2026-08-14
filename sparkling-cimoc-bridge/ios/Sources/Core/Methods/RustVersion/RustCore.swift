// Cimoc 方法包对 Rust 核心（cimoc-core）的 Swift 封装。
// uniffi 生成的绑定以顶层函数形式暴露（cimocVersion / uniffiEnsureCimocCoreInitialized）。
import Foundation

enum RustCore {
    static func version() -> String {
        uniffiEnsureCimocCoreInitialized()
        return cimocVersion()
    }
}
