// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKListDownloadedChaptersMethodParamModel)
public class SPKListDownloadedChaptersMethodParamModel: SPKMethodModel {
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
@objc(SPKListDownloadedChaptersMethodResultModel)
public class SPKListDownloadedChaptersMethodResultModel: SPKMethodModel {
    @objc public var chaptersJson: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "chaptersJson": "chaptersJson"
        ]
    }
}

// Main method class
@objc(SPKListDownloadedChaptersMethod)
public class SPKListDownloadedChaptersMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKListDownloadedChaptersMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKListDownloadedChaptersMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.listDownloadedChapters"
    }

    public override class func methodName() -> String {
        return "cimoc.listDownloadedChapters"
    }
}
