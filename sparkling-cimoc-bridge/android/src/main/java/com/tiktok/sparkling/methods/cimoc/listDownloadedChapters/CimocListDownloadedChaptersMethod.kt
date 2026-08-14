// cimoc.listDownloadedChapters — 已下载章节文件列表，JSON 编码 {chapterIndex: [paths]}（下沉 Rust 核心）。
package com.tiktok.sparkling.methods.cimoc.listDownloadedChapters

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.listdownloadedchapters.AbsListDownloadedChaptersMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore
import com.tiktok.sparkling.methods.cimoc.util.CimocNative

class CimocListDownloadedChaptersMethod : AbsListDownloadedChaptersMethodIDL() {
    override fun handle(
        params: IDLMethodListDownloadedChaptersInputModel,
        callback: CompletionBlock<IDLMethodListDownloadedChaptersResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val dir = CimocNative.downloadDir(context).absolutePath
        val json = RustCore.listDownloaded(dir, params.comicId)
        callback.onSuccess(
            IDLMethodListDownloadedChaptersResultModel::class.java.createXModel().apply {
                chaptersJson = json
            },
        )
    }
}
