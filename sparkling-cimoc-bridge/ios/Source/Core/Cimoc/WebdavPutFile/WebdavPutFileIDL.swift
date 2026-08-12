// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKWebdavPutFileMethodParamModel)
public class SPKWebdavPutFileMethodParamModel: SPKMethodModel {
    @objc public var base: String
    @objc public var user: String
    @objc public var password: String
    @objc public var fileName: String
    @objc public var content: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

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

// Result model
@objc(SPKWebdavPutFileMethodResultModel)
public class SPKWebdavPutFileMethodResultModel: SPKMethodModel {
    @objc public var success: Bool
    @objc public var status: Double

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success",
            "status": "status"
        ]
    }
}

// Main method class
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
}
