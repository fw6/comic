// cimoc.isNetworkAvailable — 网络可用性（移植自旧 NetworkModule）。
package com.tiktok.sparkling.methods.cimoc.isNetworkAvailable

import android.content.Context
import android.net.ConnectivityManager
import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.IDLBridgeMethod
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.isnetworkavailable.AbsIsNetworkAvailableMethodIDL

class CimocIsNetworkAvailableMethod : AbsIsNetworkAvailableMethodIDL() {
    override fun handle(
        params: IDLMethodIsNetworkAvailableInputModel,
        callback: CompletionBlock<IDLMethodIsNetworkAvailableResultModel>,
        type: BridgePlatformType,
    ) {
        val context = getSDKContext()?.context
        if (context == null) {
            callback.onFailure(IDLBridgeMethod.FAIL, "Context not provided in host")
            return
        }
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        callback.onSuccess(
            IDLMethodIsNetworkAvailableResultModel::class.java.createXModel().apply {
                available = cm?.activeNetwork != null
            },
        )
    }
}
