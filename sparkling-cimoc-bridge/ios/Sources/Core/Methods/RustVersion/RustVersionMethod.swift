// cimoc.rustVersion — 返回 Rust 核心（cimoc-core）版本字符串，验证 uniffi 双端加载链路。
import Foundation
import SparklingMethod

@objc(SPKRustVersionMethodResultModel)
public class SPKRustVersionMethodResultModel: SPKMethodModel {
    @objc public var version: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "version": "version"
        ]
    }
}

@objc(SPKRustVersionMethod)
public class SPKRustVersionMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return CimocEmptyParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKRustVersionMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.rustVersion"
    }

    public override class func methodName() -> String {
        return "cimoc.rustVersion"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        let result = SPKRustVersionMethodResultModel()
        result.version = RustCore.version()
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
