// cimoc.deleteComicDownload — 删除整部漫画的下载目录（移植自旧 DownloadModule.deleteComic）。
package com.tiktok.sparkling.methods.cimoc.deleteComicDownload

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.deletecomicdownload.AbsDeleteComicDownloadMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import java.io.File

class CimocDeleteComicDownloadMethod : AbsDeleteComicDownloadMethodIDL() {
    override fun handle(
        params: IDLMethodDeleteComicDownloadInputModel,
        callback: CompletionBlock<IDLMethodDeleteComicDownloadResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val comicDir = File(CimocNative.downloadDir(context), params.comicId)
        if (comicDir.exists()) comicDir.deleteRecursively()
        callback.onSuccess(
            IDLMethodDeleteComicDownloadResultModel::class.java.createXModel().apply { success = true },
        )
    }
}
