// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKPickFolderMethodParamModel)
public class SPKPickFolderMethodParamModel: SPKMethodModel {

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
        ]
    }
}

// Result model
@objc(SPKPickFolderMethodResultModel)
public class SPKPickFolderMethodResultModel: SPKMethodModel {
    @objc public var success: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

// Main method class
@objc(SPKPickFolderMethod)
public class SPKPickFolderMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKPickFolderMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKPickFolderMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.pickFolder"
    }

    public override class func methodName() -> String {
        return "cimoc.pickFolder"
    }
}
