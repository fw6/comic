// cimoc.crawl — 爬虫引擎入口，调用 Rust 核心（cimoc-core）做抓取 + 解析。
import Foundation
import SparklingMethod

@objc(SPKCrawlMethodParamModel)
public class SPKCrawlMethodParamModel: SPKMethodModel {
    @objc public var op: String?
    @objc public var sourceId: String?
    @objc public var payload: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "op": "op",
            "sourceId": "sourceId",
            "payload": "payload"
        ]
    }
}

@objc(SPKCrawlMethodResultModel)
public class SPKCrawlMethodResultModel: SPKMethodModel {
    @objc public var json: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "json": "json"
        ]
    }
}

@objc(SPKCrawlMethod)
public class SPKCrawlMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKCrawlMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKCrawlMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.crawl"
    }

    public override class func methodName() -> String {
        return "cimoc.crawl"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? SPKCrawlMethodParamModel else {
            completionHandler.handleCompletion(status: MethodStatus.failed(), result: nil)
            return
        }
        let json = RustCore.invokeCrawl(
            op: params.op ?? "",
            sourceId: params.sourceId ?? "",
            payload: params.payload ?? ""
        )
        let result = SPKCrawlMethodResultModel()
        result.json = json
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
