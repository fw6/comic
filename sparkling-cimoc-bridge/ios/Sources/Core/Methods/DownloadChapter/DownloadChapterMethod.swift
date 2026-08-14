// cimoc.downloadChapter — 下载单页图片（下沉 Rust 核心）。
import Foundation
import SparklingMethod

@objc(SPKDownloadChapterMethodParamModel)
public class SPKDownloadChapterMethodParamModel: SPKMethodModel {
    @objc public var url: String?
    @objc public var comicId: String?
    @objc public var chapterIndex: Double = 0
    @objc public var pageIndex: Double = 0

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "url": "url",
            "comicId": "comicId",
            "chapterIndex": "chapterIndex",
            "pageIndex": "pageIndex"
        ]
    }
}

@objc(SPKDownloadChapterMethodResultModel)
public class SPKDownloadChapterMethodResultModel: SPKMethodModel {
    @objc public var success: Bool = false

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

@objc(SPKDownloadChapterMethod)
public class SPKDownloadChapterMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKDownloadChapterMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKDownloadChapterMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.downloadChapter"
    }

    public override class func methodName() -> String {
        return "cimoc.downloadChapter"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? SPKDownloadChapterMethodParamModel else {
            completionHandler.handleCompletion(status: MethodStatus.failed(), result: nil)
            return
        }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("download", isDirectory: true).path
        let json = RustCore.invokeDownloadImage(
            url: params.url ?? "",
            dir: dir,
            comicId: params.comicId ?? "",
            chapterIndex: Int64(params.chapterIndex),
            pageIndex: Int64(params.pageIndex)
        )
        let result = SPKDownloadChapterMethodResultModel()
        result.success = json == "true"
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
