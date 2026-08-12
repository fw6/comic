// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKListKeysMethodParamModel)
public class SPKListKeysMethodParamModel: SPKMethodModel {

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
        ]
    }
}

// Result model
@objc(SPKListKeysMethodResultModel)
public class SPKListKeysMethodResultModel: SPKMethodModel {
    @objc public var keys: [String]

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "keys": "keys"
        ]
    }
}

// Main method class
@objc(SPKListKeysMethod)
public class SPKListKeysMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKListKeysMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKListKeysMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.listKeys"
    }

    public override class func methodName() -> String {
        return "cimoc.listKeys"
    }
}
