// cimoc.downloadChapter — 下载单页图片到 download/<comicId>/chapter_<n>/<page>.<ext>（下沉 Rust 核心）。
package com.tiktok.sparkling.methods.cimoc.downloadChapter

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.downloadchapter.AbsDownloadChapterMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore
import com.tiktok.sparkling.methods.cimoc.util.CimocNative

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
        val dir = CimocNative.downloadDir(context).absolutePath
        Thread {
            val result =
                RustCore.downloadImage(
                    params.url,
                    dir,
                    params.comicId,
                    params.chapterIndex.toLong(),
                    params.pageIndex.toLong(),
                )
            callback.onSuccess(
                IDLMethodDownloadChapterResultModel::class.java.createXModel().apply {
                    success = result == "true"
                },
            )
        }.start()
    }
}
