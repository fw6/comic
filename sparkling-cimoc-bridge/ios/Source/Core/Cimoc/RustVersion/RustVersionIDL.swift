// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKRustVersionMethodParamModel)
public class SPKRustVersionMethodParamModel: SPKMethodModel {

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
        ]
    }
}

// Result model
@objc(SPKRustVersionMethodResultModel)
public class SPKRustVersionMethodResultModel: SPKMethodModel {
    @objc public var version: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "version": "version"
        ]
    }
}

// Main method class
@objc(SPKRustVersionMethod)
public class SPKRustVersionMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKRustVersionMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKRustVersionMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.rustVersion"
    }

    public override class func methodName() -> String {
        return "cimoc.rustVersion"
    }
}
