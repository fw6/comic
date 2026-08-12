// cimoc.pickFolder — 发起 SAF 文件夹选择（移植自旧 LocalModule；SAF 断头链路为已知缺陷，行为保持现状）。
package com.tiktok.sparkling.methods.cimoc.pickFolder

import android.app.Activity
import android.content.Intent
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.pickfolder.AbsPickFolderMethodIDL

class CimocPickFolderMethod : AbsPickFolderMethodIDL() {
    override fun handle(
        params: IDLMethodPickFolderInputModel,
        callback: CompletionBlock<IDLMethodPickFolderResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        val ok =
            try {
                if (context is Activity) {
                    context.startActivityForResult(intent, REQ_PICK_FOLDER)
                    true
                } else {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                    true
                }
            } catch (e: Exception) {
                callback.onFailure(IDLBridgeMethod.FAIL, e.message ?: e.toString())
                return
            }
        callback.onSuccess(
            IDLMethodPickFolderResultModel::class.java.createXModel().apply { success = ok },
        )
    }

    private companion object {
        const val REQ_PICK_FOLDER = 1001
    }
}
