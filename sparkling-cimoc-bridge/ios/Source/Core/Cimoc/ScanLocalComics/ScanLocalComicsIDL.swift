// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKScanLocalComicsMethodParamModel)
public class SPKScanLocalComicsMethodParamModel: SPKMethodModel {

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
        ]
    }
}

// Result model
@objc(SPKScanLocalComicsMethodResultModel)
public class SPKScanLocalComicsMethodResultModel: SPKMethodModel {
    @objc public var comicsJson: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "comicsJson": "comicsJson"
        ]
    }
}

// Main method class
@objc(SPKScanLocalComicsMethod)
public class SPKScanLocalComicsMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKScanLocalComicsMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKScanLocalComicsMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.scanLocalComics"
    }

    public override class func methodName() -> String {
        return "cimoc.scanLocalComics"
    }
}
