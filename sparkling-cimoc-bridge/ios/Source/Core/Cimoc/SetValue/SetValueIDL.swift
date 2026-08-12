// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKSetValueMethodParamModel)
public class SPKSetValueMethodParamModel: SPKMethodModel {
    @objc public var key: String
    @objc public var value: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "key": "key",
            "value": "value"
        ]
    }
}

// Result model
@objc(SPKSetValueMethodResultModel)
public class SPKSetValueMethodResultModel: SPKMethodModel {
    @objc public var success: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

// Main method class
@objc(SPKSetValueMethod)
public class SPKSetValueMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKSetValueMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKSetValueMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.setValue"
    }

    public override class func methodName() -> String {
        return "cimoc.setValue"
    }
}
