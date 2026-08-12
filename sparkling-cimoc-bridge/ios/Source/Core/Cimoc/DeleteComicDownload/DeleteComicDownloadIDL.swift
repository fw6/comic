// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKDeleteComicDownloadMethodParamModel)
public class SPKDeleteComicDownloadMethodParamModel: SPKMethodModel {
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
@objc(SPKDeleteComicDownloadMethodResultModel)
public class SPKDeleteComicDownloadMethodResultModel: SPKMethodModel {
    @objc public var success: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

// Main method class
@objc(SPKDeleteComicDownloadMethod)
public class SPKDeleteComicDownloadMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKDeleteComicDownloadMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKDeleteComicDownloadMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.deleteComicDownload"
    }

    public override class func methodName() -> String {
        return "cimoc.deleteComicDownload"
    }
}
