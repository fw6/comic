// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKDownloadChapterMethodParamModel)
public class SPKDownloadChapterMethodParamModel: SPKMethodModel {
    @objc public var url: String
    @objc public var comicId: String
    @objc public var chapterIndex: Double
    @objc public var pageIndex: Double

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "url": "url",
            "comicId": "comicId",
            "chapterIndex": "chapterIndex",
            "pageIndex": "pageIndex"
        ]
    }
}

// Result model
@objc(SPKDownloadChapterMethodResultModel)
public class SPKDownloadChapterMethodResultModel: SPKMethodModel {
    @objc public var success: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

// Main method class
@objc(SPKDownloadChapterMethod)
public class SPKDownloadChapterMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKDownloadChapterMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKDownloadChapterMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.downloadChapter"
    }

    public override class func methodName() -> String {
        return "cimoc.downloadChapter"
    }
}
