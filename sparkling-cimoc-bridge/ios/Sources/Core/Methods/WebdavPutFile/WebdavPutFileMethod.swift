// cimoc.webdavPutFile — WebDAV PUT 备份（下沉 Rust 核心）。
import Foundation
import SparklingMethod

@objc(SPKWebdavPutFileMethodParamModel)
public class SPKWebdavPutFileMethodParamModel: SPKMethodModel {
    @objc public var base: String?
    @objc public var user: String?
    @objc public var password: String?
    @objc public var fileName: String?
    @objc public var content: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "base": "base",
            "user": "user",
            "password": "password",
            "fileName": "fileName",
            "content": "content"
        ]
    }
}

@objc(SPKWebdavPutFileMethodResultModel)
public class SPKWebdavPutFileMethodResultModel: SPKMethodModel {
    @objc public var success: Bool = false
    @objc public var status: Double = 0

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success",
            "status": "status"
        ]
    }
}

@objc(SPKWebdavPutFileMethod)
public class SPKWebdavPutFileMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKWebdavPutFileMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKWebdavPutFileMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.webdavPutFile"
    }

    public override class func methodName() -> String {
        return "cimoc.webdavPutFile"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? SPKWebdavPutFileMethodParamModel else {
            completionHandler.handleCompletion(status: MethodStatus.failed(), result: nil)
            return
        }
        let json = RustCore.invokeWebdavPut(
            base: params.base ?? "",
            user: params.user ?? "",
            password: params.password ?? "",
            fileName: params.fileName ?? "",
            content: params.content ?? ""
        )
        let result = SPKWebdavPutFileMethodResultModel()
        if let data = json.data(using: .utf8),
           let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            result.success = (obj["success"] as? NSNumber)?.boolValue ?? false
            result.status = (obj["status"] as? NSNumber)?.doubleValue ?? 0
        }
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
