// cimoc.listDownloadedChapters — 已下载章节文件列表，JSON 编码 {chapterIndex: [paths]}（移植自旧 DownloadModule.listDownloaded）。
package com.tiktok.sparkling.methods.cimoc.listDownloadedChapters

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.listdownloadedchapters.AbsListDownloadedChaptersMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import org.json.JSONObject
import java.io.File

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
        val comicDir = File(CimocNative.downloadDir(context), params.comicId)
        val json = JSONObject()
        comicDir.listFiles()?.forEach { chapterDir ->
            if (chapterDir.isDirectory) {
                val idx = CimocNative.chapterIndexFromDirName(chapterDir.name) ?: return@forEach
                val files = chapterDir.listFiles()?.sortedBy { it.name } ?: emptyList()
                if (files.isNotEmpty()) {
                    json.put(idx.toString(), files.map { it.absolutePath })
                }
            }
        }
        callback.onSuccess(
            IDLMethodListDownloadedChaptersResultModel::class.java.createXModel().apply {
                chaptersJson = json.toString()
            },
        )
    }
}
