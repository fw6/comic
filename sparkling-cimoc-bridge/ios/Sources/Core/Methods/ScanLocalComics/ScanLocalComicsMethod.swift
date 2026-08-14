// cimoc.scanLocalComics — 扫描本地已下载漫画（下沉 Rust 核心）。
import Foundation
import SparklingMethod

@objc(SPKScanLocalComicsMethodResultModel)
public class SPKScanLocalComicsMethodResultModel: SPKMethodModel {
    @objc public var comicsJson: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "comicsJson": "comicsJson"
        ]
    }
}

@objc(SPKScanLocalComicsMethod)
public class SPKScanLocalComicsMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return CimocEmptyParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKScanLocalComicsMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.scanLocalComics"
    }

    public override class func methodName() -> String {
        return "cimoc.scanLocalComics"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent("download", isDirectory: true).path
        let result = SPKScanLocalComicsMethodResultModel()
        result.comicsJson = RustCore.invokeScanLocal(dir: dir)
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
