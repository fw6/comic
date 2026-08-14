// Cimoc 方法包共享宿主资源：本地下载目录约定。
// HTTP/文件 IO 逻辑已下沉 Rust 核心（cimoc-core），此处仅保留原生侧平台路径计算。
package com.tiktok.sparkling.methods.cimoc.util

import android.content.Context
import java.io.File

object CimocNative {
    /** 下载目录：getExternalFilesDir/download（与旧 DownloadModule 一致）。 */
    fun downloadDir(context: Context): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        val dir = File(base, "download")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }
}
