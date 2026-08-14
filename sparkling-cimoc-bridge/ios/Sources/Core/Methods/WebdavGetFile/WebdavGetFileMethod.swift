// cimoc.webdavGetFile — WebDAV GET 读取备份（下沉 Rust 核心）。
import Foundation
import SparklingMethod

@objc(SPKWebdavGetFileMethodParamModel)
public class SPKWebdavGetFileMethodParamModel: SPKMethodModel {
    @objc public var base: String?
    @objc public var user: String?
    @objc public var password: String?
    @objc public var fileName: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "base": "base",
            "user": "user",
            "password": "password",
            "fileName": "fileName"
        ]
    }
}

@objc(SPKWebdavGetFileMethodResultModel)
public class SPKWebdavGetFileMethodResultModel: SPKMethodModel {
    @objc public var ok: Bool = false
    @objc public var content: String?
    @objc public var status: NSNumber?
    @objc public var error: String?

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "ok": "ok",
            "content": "content",
            "status": "status",
            "error": "error"
        ]
    }
}

@objc(SPKWebdavGetFileMethod)
public class SPKWebdavGetFileMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKWebdavGetFileMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKWebdavGetFileMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.webdavGetFile"
    }

    public override class func methodName() -> String {
        return "cimoc.webdavGetFile"
    }

    @objc public override func call(withParamModel paramModel: Any, completionHandler: CompletionHandlerProtocol) {
        guard let params = paramModel as? SPKWebdavGetFileMethodParamModel else {
            completionHandler.handleCompletion(status: MethodStatus.failed(), result: nil)
            return
        }
        let json = RustCore.invokeWebdavGet(
            base: params.base ?? "",
            user: params.user ?? "",
            password: params.password ?? "",
            fileName: params.fileName ?? ""
        )
        let result = SPKWebdavGetFileMethodResultModel()
        if let data = json.data(using: .utf8),
           let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            result.ok = (obj["ok"] as? NSNumber)?.boolValue ?? false
            result.content = obj["content"] as? String
            result.status = obj["status"] as? NSNumber
            result.error = obj["error"] as? String
        }
        completionHandler.handleCompletion(status: MethodStatus.succeeded(), result: result)
    }
}
