// cimoc.isNetworkAvailable — 网络可用性。iOS 暂未实现，调用统一返回 not-implemented（Android 已实现）。
import Foundation
import SparklingMethod

@objc(SPKIsNetworkAvailableMethod)
public class SPKIsNetworkAvailableMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return CimocEmptyParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return CimocEmptyResultModel.self
    }

    public override var methodName: String {
        return "cimoc.isNetworkAvailable"
    }

    public override class func methodName() -> String {
        return "cimoc.isNetworkAvailable"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        handleNotImplemented(message: "cimoc.isNetworkAvailable is not implemented on iOS yet") { status, result in
            completionHandler.handleCompletion(status: status, result: result)
        }
    }
}
