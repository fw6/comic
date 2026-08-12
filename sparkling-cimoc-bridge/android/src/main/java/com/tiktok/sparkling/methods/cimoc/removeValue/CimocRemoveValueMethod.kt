// cimoc.removeValue — 删除 filesDir/data/<key>.json（移植自旧 StorageModule）。
package com.tiktok.sparkling.methods.cimoc.removeValue

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.removevalue.AbsRemoveValueMethodIDL
import com.tiktok.sparkling.methods.cimoc.util.CimocNative
import java.io.File

class CimocRemoveValueMethod : AbsRemoveValueMethodIDL() {
    override fun handle(
        params: IDLMethodRemoveValueInputModel,
        callback: CompletionBlock<IDLMethodRemoveValueResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val ok =
            try {
                val file = File(CimocNative.storageDir(context), "${params.key}.json")
                if (file.exists()) file.delete()
                true
            } catch (e: Exception) {
                false
            }
        callback.onSuccess(
            IDLMethodRemoveValueResultModel::class.java.createXModel().apply { success = ok },
        )
    }
}
