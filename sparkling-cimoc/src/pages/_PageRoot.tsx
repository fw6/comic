import { useEffect, type ReactNode } from '@lynx-js/react';
import { hydrateAppState } from '../cimoc/store.js';

/**
 * 页面根：通知 Sparkling 关闭 splash（onMounted 由容器注入），并在挂载时从原生存储
 * 恢复全局状态。每个 Lynx 容器（页面）独立运行，因此每页挂载时都要 hydrate 一次。
 */
export function PageRoot({
    onMounted,
    children,
}: {
    onMounted?: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        onMounted?.();
    }, [onMounted]);

    useEffect(() => {
        void hydrateAppState();
    }, []);

    return <>{children}</>;
}
