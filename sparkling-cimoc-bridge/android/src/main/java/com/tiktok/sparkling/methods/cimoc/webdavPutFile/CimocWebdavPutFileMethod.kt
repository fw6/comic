// cimoc.webdavPutFile — WebDAV PUT 备份文件（下沉 Rust 核心：reqwest + Basic Auth）。
package com.tiktok.sparkling.methods.cimoc.webdavPutFile

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.webdavputfile.AbsWebdavPutFileMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore
import org.json.JSONObject

class CimocWebdavPutFileMethod : AbsWebdavPutFileMethodIDL() {
    override fun handle(
        params: IDLMethodWebdavPutFileInputModel,
        callback: CompletionBlock<IDLMethodWebdavPutFileResultModel>,
        type: BridgePlatformType,
    ) {
        Thread {
            val json = RustCore.webdavPut(params.base, params.user, params.password, params.fileName, params.content)
            val obj = JSONObject(json)
            callback.onSuccess(
                IDLMethodWebdavPutFileResultModel::class.java.createXModel().apply {
                    success = obj.optBoolean("success")
                    status = obj.optInt("status")
                },
            )
        }.start()
    }
}
