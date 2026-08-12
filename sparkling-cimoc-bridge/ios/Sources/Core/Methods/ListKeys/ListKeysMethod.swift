// cimoc.listKeys — 列出持久化键名。iOS 暂未实现，调用统一返回 not-implemented（Android 已实现）。
import Foundation
import SparklingMethod

@objc(SPKListKeysMethod)
public class SPKListKeysMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return CimocEmptyParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return CimocEmptyResultModel.self
    }

    public override var methodName: String {
        return "cimoc.listKeys"
    }

    public override class func methodName() -> String {
        return "cimoc.listKeys"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        handleNotImplemented(message: "cimoc.listKeys is not implemented on iOS yet") { status, result in
            completionHandler.handleCompletion(status: status, result: result)
        }
    }
}
