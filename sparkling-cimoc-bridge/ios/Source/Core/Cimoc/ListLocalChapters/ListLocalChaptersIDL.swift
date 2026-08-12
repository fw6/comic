// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKListLocalChaptersMethodParamModel)
public class SPKListLocalChaptersMethodParamModel: SPKMethodModel {
    @objc public var comicId: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "comicId": "comicId"
        ]
    }
}

// Result model
@objc(SPKListLocalChaptersMethodResultModel)
public class SPKListLocalChaptersMethodResultModel: SPKMethodModel {
    @objc public var chaptersJson: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "chaptersJson": "chaptersJson"
        ]
    }
}

// Main method class
@objc(SPKListLocalChaptersMethod)
public class SPKListLocalChaptersMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKListLocalChaptersMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKListLocalChaptersMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.listLocalChapters"
    }

    public override class func methodName() -> String {
        return "cimoc.listLocalChapters"
    }
}
