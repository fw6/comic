// cimoc.rustVersion — 返回 Rust 核心（cimoc-core）版本字符串，验证 uniffi 双端加载链路。
package com.tiktok.sparkling.methods.cimoc.rustVersion

import com.tiktok.sparkling.method.registry.core.BridgePlatformType
import com.tiktok.sparkling.method.registry.core.model.idl.CompletionBlock
import com.tiktok.sparkling.method.registry.core.utils.createXModel
import com.tiktok.sparkling.methods.cimoc.cimoc.rustversion.AbsRustVersionMethodIDL
import com.tiktok.sparkling.methods.cimoc.rust.RustCore

class CimocRustVersionMethod : AbsRustVersionMethodIDL() {
    override fun handle(
        params: IDLMethodRustVersionInputModel,
        callback: CompletionBlock<IDLMethodRustVersionResultModel>,
        type: BridgePlatformType,
    ) {
        callback.onSuccess(
            IDLMethodRustVersionResultModel::class.java.createXModel().apply {
                version = RustCore.version()
            },
        )
    }
}
