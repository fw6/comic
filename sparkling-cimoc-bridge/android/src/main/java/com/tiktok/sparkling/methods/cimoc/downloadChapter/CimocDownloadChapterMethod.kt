// cimoc.downloadChapter — 下载单页图片到 download/<comicId>/chapter_<n>/<page>.<ext>（移植自旧 DownloadModule）。
package com.tiktok.sparkling.methods.cimoc.downloadChapter

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.downloadchapter.AbsDownloadChapterMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import okhttp3.Request
import java.io.File

class CimocDownloadChapterMethod : AbsDownloadChapterMethodIDL() {
    override fun handle(
        params: IDLMethodDownloadChapterInputModel,
        callback: CompletionBlock<IDLMethodDownloadChapterResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val chapterIndex = params.chapterIndex.toInt()
        val pageIndex = params.pageIndex.toInt()
        Thread {
            try {
                val comicDir = File(CimocNative.downloadDir(context), params.comicId)
                val chapterDir = File(comicDir, CimocNative.chapterDirName(chapterIndex))
                if (!chapterDir.exists()) chapterDir.mkdirs()
                val ext = params.url.substringAfterLast('.', "jpg").take(5)
                val file = File(chapterDir, "$pageIndex.$ext")
                val req =
                    Request.Builder()
                        .url(params.url)
                        .header("User-Agent", CimocNative.UA)
                        .build()
                CimocNative.http().newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) {
                        callback.onFailure(IDLBridgeMethod.FAIL, "HTTP ${resp.code}")
                        return@Thread
                    }
                    val body = resp.body ?: run {
                        callback.onFailure(IDLBridgeMethod.FAIL, "no body")
                        return@Thread
                    }
                    file.outputStream().use { out -> body.byteStream().copyTo(out) }
                    callback.onSuccess(
                        IDLMethodDownloadChapterResultModel::class.java.createXModel().apply { success = true },
                    )
                }
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
            }
        }.start()
    }
}
