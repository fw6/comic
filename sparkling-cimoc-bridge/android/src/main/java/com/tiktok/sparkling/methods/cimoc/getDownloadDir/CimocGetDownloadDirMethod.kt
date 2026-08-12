// cimoc.getDownloadDir — 下载根目录绝对路径（移植自旧 DownloadModule）。
package com.tiktok.sparkling.methods.cimoc.getDownloadDir

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.getdownloaddir.AbsGetDownloadDirMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative

class CimocGetDownloadDirMethod : AbsGetDownloadDirMethodIDL() {
    override fun handle(
        params: IDLMethodGetDownloadDirInputModel,
        callback: CompletionBlock<IDLMethodGetDownloadDirResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        callback.onSuccess(
            IDLMethodGetDownloadDirResultModel::class.java.createXModel().apply {
                dir = CimocNative.downloadDir(context).absolutePath
            },
        )
    }
}
