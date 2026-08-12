// cimoc.getBytes — HTTP GET 下载二进制（base64）。iOS 暂未实现，调用统一返回 not-implemented（Android 已实现）。
import Foundation
import SparklingMethod

@objc(SPKGetBytesMethod)
public class SPKGetBytesMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return CimocEmptyParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return CimocEmptyResultModel.self
    }

    public override var methodName: String {
        return "cimoc.getBytes"
    }

    public override class func methodName() -> String {
        return "cimoc.getBytes"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        handleNotImplemented(message: "cimoc.getBytes is not implemented on iOS yet") { status, result in
            completionHandler.handleCompletion(status: status, result: result)
        }
    }
}
