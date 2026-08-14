// cimoc.listDownloadedChapters — 已下载章节文件列表（下沉 Rust 核心）。
import Foundation
import SparklingMethod

@objc(SPKListDownloadedChaptersMethodParamModel)
public class SPKListDownloadedChaptersMethodParamModel: SPKMethodModel {
    @objc public var comicId: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "comicId": "comicId"
        ]
    }
}

@objc(SPKListDownloadedChaptersMethodResultModel)
public class SPKListDownloadedChaptersMethodResultModel: SPKMethodModel {
    @objc public var chaptersJson: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "chaptersJson": "chaptersJson"
        ]
    }
}

@objc(SPKListDownloadedChaptersMethod)
public class SPKListDownloadedChaptersMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKListDownloadedChaptersMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKListDownloadedChaptersMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.listDownloadedChapters"
    }

    public override class func methodName() -> String {
        return "cimoc.listDownloadedChapters"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? SPKListDownloadedChaptersMethodParamModel else {
            completionHandler.handleCompletion(status: MethodStatus.failed(), result: nil)
            return
        }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("download", isDirectory: true).path
        let result = SPKListDownloadedChaptersMethodResultModel()
        result.chaptersJson = RustCore.invokeListDownloaded(dir: dir, comicId: params.comicId ?? "")
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
