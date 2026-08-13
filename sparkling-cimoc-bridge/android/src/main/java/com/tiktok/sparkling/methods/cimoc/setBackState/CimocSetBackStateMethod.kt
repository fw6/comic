// cimoc.setBackState — JS 导航栈可返回状态上报，宿主据此决定系统返回手势行为。
package com.tiktok.sparkling.methods.cimoc.setBackState

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.back.CimocBackInterceptor
import com.tiktok.sparkling.methods.cimoc.cimoc.setbackstate.AbsSetBackStateMethodIDL

class CimocSetBackStateMethod : AbsSetBackStateMethodIDL() {
    override fun handle(
        params: IDLMethodSetBackStateInputModel,
        callback: CompletionBlock<IDLMethodSetBackStateResultModel>,
        type: BridgePlatformType,
    ) {
        val ctx = getSDKContext()
        CimocBackInterceptor.setCanGoBack(params.canGoBack)
        if (ctx != null) CimocBackInterceptor.install(ctx.context, ctx)
        callback.onSuccess(
            IDLMethodSetBackStateResultModel::class.java.createXModel().apply { success = true },
        )
    }
}
