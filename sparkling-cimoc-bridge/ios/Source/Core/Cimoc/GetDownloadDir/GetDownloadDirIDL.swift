// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKGetDownloadDirMethodParamModel)
public class SPKGetDownloadDirMethodParamModel: SPKMethodModel {

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
        ]
    }
}

// Result model
@objc(SPKGetDownloadDirMethodResultModel)
public class SPKGetDownloadDirMethodResultModel: SPKMethodModel {
    @objc public var dir: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "dir": "dir"
        ]
    }
}

// Main method class
@objc(SPKGetDownloadDirMethod)
public class SPKGetDownloadDirMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKGetDownloadDirMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKGetDownloadDirMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.getDownloadDir"
    }

    public override class func methodName() -> String {
        return "cimoc.getDownloadDir"
    }
}
