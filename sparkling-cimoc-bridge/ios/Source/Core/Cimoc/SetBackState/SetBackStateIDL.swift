// Copyright 2025 The Sparkling Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Foundation
import SparklingMethod

// Auto-generated temporary model types
// Parameter model
@objc(SPKSetBackStateMethodParamModel)
public class SPKSetBackStateMethodParamModel: SPKMethodModel {
    @objc public var canGoBack: Bool

    @objc public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "canGoBack": "canGoBack"
        ]
    }
}

// Result model
@objc(SPKSetBackStateMethodResultModel)
public class SPKSetBackStateMethodResultModel: SPKMethodModel {
    @objc public var success: Bool

    @objc public override class func jsonKeyPathsByPropertyKey() -> [AnyHashable: Any] {
        return [
            "success": "success"
        ]
    }
}

// Main method class
// iOS 无系统返回手势，仅作为桩注册（Android 端实现系统返回 → JS 弹栈）。
@objc(SPKSetBackStateMethod)
public class SPKSetBackStateMethod: PipeMethod {
    @objc public override var paramsModelClass: AnyClass {
        return SPKSetBackStateMethodParamModel.self
    }

    @objc public override var resultModelClass: AnyClass {
        return SPKSetBackStateMethodResultModel.self
    }

    public override var methodName: String {
        return "cimoc.setBackState"
    }

    public override class func methodName() -> String {
        return "cimoc.setBackState"
    }
}
