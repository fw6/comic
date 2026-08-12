// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKWebdavGetFileMethodParamModel)
public class SPKWebdavGetFileMethodParamModel: SPKMethodModel {
    @objc public var base: String
    @objc public var user: String
    @objc public var password: String
    @objc public var fileName: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "base": "base",
            "user": "user",
            "password": "password",
            "fileName": "fileName"
        ]
    }
}

// Result model
@objc(SPKWebdavGetFileMethodResultModel)
public class SPKWebdavGetFileMethodResultModel: SPKMethodModel {
    @objc public var ok: Bool
    @objc public var content: String?
    @objc public var status: Double?
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

// Main method class
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
}
