package com.cimoc.app

import com.lynx.jsbridge.Arguments
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * 下载桥：将网络图片（章节页面）下载到应用外部私有目录 Cimoc/download/。
 * 对应 Cimoc 的下载功能（下载队列保存到 download/ 目录）。
 */
class DownloadModule(context: android.content.Context) : LynxModule(context) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private fun baseDir(): File {
        val dir = File(mContext.getExternalFilesDir(null), "download")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    @LynxMethod
    fun download(url: String, comicId: String, chapterIndex: Int, pageIndex: Int, callback: Callback) {
        Thread {
            try {
                val comicDir = File(baseDir(), comicId)
                val chapterDir = File(comicDir, "chapter_$chapterIndex")
                if (!chapterDir.exists()) chapterDir.mkdirs()
                val ext = url.substringAfterLast('.', "jpg").take(5)
                val file = File(chapterDir, "$pageIndex.$ext")
                val req = Request.Builder().url(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) {
                        callback.invoke(false, "HTTP ${resp.code}")
                        return@Thread
                    }
                    val body = resp.body ?: return@Thread.also { callback.invoke(false, "no body") }
                    file.outputStream().use { out -> body.byteStream().copyTo(out) }
                    callback.invoke(true, file.absolutePath)
                }
            } catch (e: Exception) {
                callback.invoke(false, e.message ?: e.toString())
            }
        }.start()
    }

    /** 已下载章节的本地文件列表，返回 { chapterIndex: [paths] } */
    @LynxMethod
    fun listDownloaded(comicId: String, callback: Callback) {
        val comicDir = File(baseDir(), comicId)
        val map = Arguments.createMap()
        if (comicDir.exists()) {
            comicDir.listFiles()?.forEach { chapterDir ->
                if (chapterDir.isDirectory) {
                    val idx = chapterDir.name.removePrefix("chapter_").toIntOrNull() ?: return@forEach
                    val files = chapterDir.listFiles()?.sortedBy { it.name } ?: emptyList()
                    if (files.isNotEmpty()) {
                        val arr = Arguments.createArray()
                        files.forEach { arr.pushString(it.absolutePath) }
                        map.putArray(idx.toString(), arr)
                    }
                }
            }
        }
        callback.invoke(map)
    }

    @LynxMethod
    fun deleteComic(comicId: String, callback: Callback) {
        val comicDir = File(baseDir(), comicId)
        if (comicDir.exists()) comicDir.deleteRecursively()
        callback.invoke(true)
    }

    @LynxMethod
    fun getDownloadDir(callback: Callback) {
        callback.invoke(baseDir().absolutePath)
    }
}
