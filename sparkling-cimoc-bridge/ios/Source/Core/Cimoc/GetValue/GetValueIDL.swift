// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKGetValueMethodParamModel)
public class SPKGetValueMethodParamModel: SPKMethodModel {
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
@objc(SPKGetValueMethodResultModel)
public class SPKGetValueMethodResultModel: SPKMethodModel {
    @objc public var value: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "value": "value"
        ]
    }
}

// Main method class
@objc(SPKGetValueMethod)
public class SPKGetValueMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKGetValueMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKGetValueMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.getValue"
    }

    public override class func methodName() -> String {
        return "cimoc.getValue"
    }
}
