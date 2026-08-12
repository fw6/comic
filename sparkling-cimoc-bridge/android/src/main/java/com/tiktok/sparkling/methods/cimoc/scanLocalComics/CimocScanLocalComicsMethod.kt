// cimoc.scanLocalComics — 扫描本地已下载漫画，JSON 编码 [{comicId, chapterCount}]（移植自旧 LocalModule）。
package com.tiktok.sparkling.methods.cimoc.scanLocalComics

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.scanlocalcomics.AbsScanLocalComicsMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import org.json.JSONArray
import org.json.JSONObject

class CimocScanLocalComicsMethod : AbsScanLocalComicsMethodIDL() {
    override fun handle(
        params: IDLMethodScanLocalComicsInputModel,
        callback: CompletionBlock<IDLMethodScanLocalComicsResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val base = CimocNative.downloadDir(context)
        val arr = JSONArray()
        base.listFiles()?.forEach { comicDir ->
            if (comicDir.isDirectory) {
                arr.put(
                    JSONObject()
                        .put("comicId", comicDir.name)
                        .put("chapterCount", comicDir.listFiles()?.size ?: 0),
                )
            }
        }
        callback.onSuccess(
            IDLMethodScanLocalComicsResultModel::class.java.createXModel().apply {
                comicsJson = arr.toString()
            },
        )
    }
}
