import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * 代理图重试（research #31 换代理）：图片经本机 HTTP 代理（127.0.0.1:<port>）取图。
 * iOS 元素卸载仍会 abort 在途请求、慢网下首次请求也可能落空；Rust 侧下载在后台完成
 * 后已进 LRU/磁盘缓存，按指数退避重建 <img> 重试同一 URL 即命中缓存成功。
 * src 变化重置计数；超过最大次数停止重试。
 */
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 300;

export default function ProxyImage({
    src,
    alt,
    style,
    className,
}: {
    src: string;
    alt: string;
    style?: CSSProperties;
    className?: string;
}) {
    const [attempt, setAttempt] = useState(0);
    const aliveRef = useRef(true);
    const srcRef = useRef(src);

    useEffect(() => {
        srcRef.current = src;
        setAttempt(0);
    }, [src]);

    useEffect(
        () => () => {
            aliveRef.current = false;
        },
        [],
    );

    const onError = () => {
        if (attempt >= MAX_ATTEMPTS) return;
        const scheduledSrc = srcRef.current;
        setTimeout(() => {
            // 重试窗口内换了 src / 组件已卸载则放弃本次重试
            if (!aliveRef.current || srcRef.current !== scheduledSrc) return;
            setAttempt((a) => a + 1);
        }, BASE_DELAY_MS * 2 ** attempt);
    };

    // key=attempt 重建 <img>：同一 src 重新发起请求
    return (
        <img
            key={attempt}
            src={src}
            alt={alt}
            style={style}
            className={className}
            onError={onError}
        />
    );
}
