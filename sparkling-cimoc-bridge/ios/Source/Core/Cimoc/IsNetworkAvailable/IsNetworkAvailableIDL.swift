// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKIsNetworkAvailableMethodParamModel)
public class SPKIsNetworkAvailableMethodParamModel: SPKMethodModel {

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
        ]
    }
}

// Result model
@objc(SPKIsNetworkAvailableMethodResultModel)
public class SPKIsNetworkAvailableMethodResultModel: SPKMethodModel {
    @objc public var available: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "available": "available"
        ]
    }
}

// Main method class
@objc(SPKIsNetworkAvailableMethod)
public class SPKIsNetworkAvailableMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKIsNetworkAvailableMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKIsNetworkAvailableMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.isNetworkAvailable"
    }

    public override class func methodName() -> String {
        return "cimoc.isNetworkAvailable"
    }
}
