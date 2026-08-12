// cimoc.deleteComicDownload — 删除漫画下载。iOS 暂未实现，调用统一返回 not-implemented（Android 已实现）。
import Foundation
import SparklingMethod

@objc(SPKDeleteComicDownloadMethod)
public class SPKDeleteComicDownloadMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return CimocEmptyParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return CimocEmptyResultModel.self
    }

    public override var methodName: String {
        return "cimoc.deleteComicDownload"
    }

    public override class func methodName() -> String {
        return "cimoc.deleteComicDownload"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        handleNotImplemented(message: "cimoc.deleteComicDownload is not implemented on iOS yet") { status, result in
            completionHandler.handleCompletion(status: status, result: result)
        }
    }
}
