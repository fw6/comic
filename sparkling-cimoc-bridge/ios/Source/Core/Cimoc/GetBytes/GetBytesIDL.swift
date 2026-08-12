// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKGetBytesMethodParamModel)
public class SPKGetBytesMethodParamModel: SPKMethodModel {
    @objc public var url: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "url": "url"
        ]
    }
}

// Result model
@objc(SPKGetBytesMethodResultModel)
public class SPKGetBytesMethodResultModel: SPKMethodModel {
    @objc public var status: Double
    @objc public var base64: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "status": "status",
            "base64": "base64"
        ]
    }
}

// Main method class
@objc(SPKGetBytesMethod)
public class SPKGetBytesMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKGetBytesMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKGetBytesMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.getBytes"
    }

    public override class func methodName() -> String {
        return "cimoc.getBytes"
    }
}
