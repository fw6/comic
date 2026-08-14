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

    private external fun nativeWebdavPut(base: String, user: String, password: String, fileName: String, content: String): String

    private external fun nativeWebdavGet(base: String, user: String, password: String, fileName: String): String

    private external fun nativeDownloadImage(url: String, dir: String, comicId: String, chapterIndex: Long, pageIndex: Long): String

    private external fun nativeListDownloaded(dir: String, comicId: String): String

    private external fun nativeScanLocal(dir: String): String

    fun version(): String = nativeVersion()

    fun add(a: Int, b: Int): Int = nativeAdd(a, b)

    fun crawl(op: String, sourceId: String, payload: String): String =
        nativeCrawl(op, sourceId, payload)

    fun webdavPut(base: String, user: String, password: String, fileName: String, content: String): String =
        nativeWebdavPut(base, user, password, fileName, content)

    fun webdavGet(base: String, user: String, password: String, fileName: String): String =
        nativeWebdavGet(base, user, password, fileName)

    fun downloadImage(url: String, dir: String, comicId: String, chapterIndex: Long, pageIndex: Long): String =
        nativeDownloadImage(url, dir, comicId, chapterIndex, pageIndex)

    fun listDownloaded(dir: String, comicId: String): String =
        nativeListDownloaded(dir, comicId)

    fun scanLocal(dir: String): String = nativeScanLocal(dir)
}
