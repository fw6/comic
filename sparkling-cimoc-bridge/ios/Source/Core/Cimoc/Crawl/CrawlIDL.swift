// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKCrawlMethodParamModel)
public class SPKCrawlMethodParamModel: SPKMethodModel {
    @objc public var op: String
    @objc public var sourceId: String
    @objc public var payload: String

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "op": "op",
            "sourceId": "sourceId",
            "payload": "payload"
        ]
    }
}

// Result model
@objc(SPKCrawlMethodResultModel)
public class SPKCrawlMethodResultModel: SPKMethodModel {
    @objc public var json: String

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "json": "json"
        ]
    }
}

// Main method class
@objc(SPKCrawlMethod)
public class SPKCrawlMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKCrawlMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKCrawlMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.crawl"
    }

    public override class func methodName() -> String {
        return "cimoc.crawl"
    }
}
