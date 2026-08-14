// Cimoc 方法包对 Rust 核心（cimoc-core）的 Kotlin 封装。
// 手写 JNI 绑定：System.loadLibrary("cimoc_core") + external 直接调 Rust 导出的 JNI 符号。
// 不用 uniffi 的 Kotlin 绑定——其依赖 JNA，在 16KB page size 设备上 libjnidispatch.so 无法加载。
package com.tiktok.sparkling.methods.cimoc.rust

object RustCore {
    init {
        System.loadLibrary("cimoc_core")
    }

    private external fun nativeVersion(): String

    private external fun nativeAdd(a: Int, b: Int): Int

    private external fun nativeCrawl(op: String, sourceId: String, payload: String): String

    fun version(): String = nativeVersion()

    fun add(a: Int, b: Int): Int = nativeAdd(a, b)

    fun crawl(op: String, sourceId: String, payload: String): String =
        nativeCrawl(op, sourceId, payload)
}
