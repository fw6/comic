// cimoc.listLocalChapters — 列出某漫画本地章节，JSON 编码 [{chapterIndex, pageCount, dir}]（移植自旧 LocalModule）。
package com.tiktok.sparkling.methods.cimoc.listLocalChapters

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.listlocalchapters.AbsListLocalChaptersMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class CimocListLocalChaptersMethod : AbsListLocalChaptersMethodIDL() {
    override fun handle(
        params: IDLMethodListLocalChaptersInputModel,
        callback: CompletionBlock<IDLMethodListLocalChaptersResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val comicDir = File(CimocNative.downloadDir(context), params.comicId)
        val arr = JSONArray()
        comicDir.listFiles()?.forEach { chapterDir ->
            if (chapterDir.isDirectory) {
                val idx = CimocNative.chapterIndexFromDirName(chapterDir.name) ?: return@forEach
                arr.put(
                    JSONObject()
                        .put("chapterIndex", idx)
                        .put("pageCount", chapterDir.listFiles()?.size ?: 0)
                        .put("dir", chapterDir.absolutePath),
                )
            }
        }
        callback.onSuccess(
            IDLMethodListLocalChaptersResultModel::class.java.createXModel().apply {
                chaptersJson = arr.toString()
            },
        )
    }
}
