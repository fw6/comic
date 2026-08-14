// cimoc.webdavGetFile — WebDAV GET 读取备份（下沉 Rust 核心：reqwest + Basic Auth）。
package com.tiktok.sparkling.methods.cimoc.webdavGetFile

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.webdavgetfile.AbsWebdavGetFileMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore
import org.json.JSONObject

class CimocWebdavGetFileMethod : AbsWebdavGetFileMethodIDL() {
    override fun handle(
        params: IDLMethodWebdavGetFileInputModel,
        callback: CompletionBlock<IDLMethodWebdavGetFileResultModel>,
        type: BridgePlatformType,
    ) {
        Thread {
            val json = RustCore.webdavGet(params.base, params.user, params.password, params.fileName)
            val obj = JSONObject(json)
            callback.onSuccess(
                IDLMethodWebdavGetFileResultModel::class.java.createXModel().apply {
                    ok = obj.optBoolean("ok")
                    if (!obj.isNull("content")) content = obj.optString("content")
                    if (!obj.isNull("status")) status = obj.optInt("status")
                    if (!obj.isNull("error")) error = obj.optString("error")
                },
            )
        }.start()
    }
}
