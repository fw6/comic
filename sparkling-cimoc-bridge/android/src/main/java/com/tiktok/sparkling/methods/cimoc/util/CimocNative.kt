// Cimoc 方法包共享宿主资源：okhttp 客户端与目录约定。
// 移植自旧 LynxModule（NetworkModule/DownloadModule/WebDavModule 共用的实现细节）。
package com.tiktok.sparkling.methods.cimoc.util

import android.content.Context
import okhttp3.OkHttpClient
import java.io.File
import java.util.concurrent.TimeUnit

object CimocNative {
    /** 与旧桥一致：抓取/下载共用同一客户端，允许重定向。 */
    private val http: OkHttpClient =
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()

    const val UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"

    fun http(): OkHttpClient = http

    /** 持久化目录：filesDir/data/<key>.json（与旧 StorageModule 一致）。 */
    fun storageDir(context: Context): File {
        val dir = File(context.filesDir, "data")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    /** 下载目录：getExternalFilesDir/download（与旧 DownloadModule 一致）。 */
    fun downloadDir(context: Context): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        val dir = File(base, "download")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    /** 解码 JSON 字符串编码的请求头 Map<string,string>；空串/非法 JSON 视为无额外头。 */
    fun parseHeaders(json: String?): Map<String, String> {
        if (json.isNullOrBlank()) return emptyMap()
        return try {
            val obj = org.json.JSONObject(json)
            val result = HashMap<String, String>()
            val keys = obj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                result[k] = obj.optString(k)
            }
            result
        } catch (e: Exception) {
            emptyMap()
        }
    }

    /** 章节目录名：chapter_<index>。 */
    fun chapterDirName(index: Int): String = "chapter_$index"

    /** 从章节目录名解析章节号，非 chapter_ 前缀返回 null。 */
    fun chapterIndexFromDirName(name: String): Int? = name.removePrefix("chapter_").toIntOrNull()
}
