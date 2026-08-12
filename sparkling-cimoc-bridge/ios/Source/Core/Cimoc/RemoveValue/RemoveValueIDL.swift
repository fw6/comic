// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKRemoveValueMethodParamModel)
public class SPKRemoveValueMethodParamModel: SPKMethodModel {
    @objc public var key: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "key": "key"
        ]
    }
}

// Result model
@objc(SPKRemoveValueMethodResultModel)
public class SPKRemoveValueMethodResultModel: SPKMethodModel {
    @objc public var success: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

// Main method class
@objc(SPKRemoveValueMethod)
public class SPKRemoveValueMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKRemoveValueMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKRemoveValueMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.removeValue"
    }

    public override class func methodName() -> String {
        return "cimoc.removeValue"
    }
}
