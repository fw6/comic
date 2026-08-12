// Cimoc 方法包共享的占位参数/结果模型。
// iOS 端 5 个原生模块尚未实现：所有方法统一返回 not-implemented，参数与结果模型不参与实际数据处理。
// 后续逐个实现时，为对应方法替换为真实的参数/结果模型（参照 sparkling-storage 的写法）。
import Foundation
import SparklingMethod

@objc(CimocEmptyParamModel)
public class CimocEmptyParamModel: SPKMethodModel {
    public override class func requiredKeyPaths() -> Set<String>? {
        return nil
    }
}

@objc(CimocEmptyResultModel)
public class CimocEmptyResultModel: SPKMethodModel {}
