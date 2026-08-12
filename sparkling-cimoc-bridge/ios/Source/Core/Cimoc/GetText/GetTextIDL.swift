// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKGetTextMethodParamModel)
public class SPKGetTextMethodParamModel: SPKMethodModel {
    @objc public var url: String
    @objc public var headers: String?

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "url": "url",
            "headers": "headers"
        ]
    }
}

// Result model
@objc(SPKGetTextMethodResultModel)
public class SPKGetTextMethodResultModel: SPKMethodModel {
    @objc public var status: Double
    @objc public var body: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "status": "status",
            "body": "body"
        ]
    }
}

// Main method class
@objc(SPKGetTextMethod)
public class SPKGetTextMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKGetTextMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKGetTextMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.getText"
    }

    public override class func methodName() -> String {
        return "cimoc.getText"
    }
}
