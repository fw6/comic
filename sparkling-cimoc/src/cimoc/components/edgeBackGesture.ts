import { useRef } from '@lynx-js/react';

/**
 * 左边缘右滑返回手势。
 * 触摸事件用 bind*（冒泡）挂在屏幕根节点，可观察整屏手势但不拦截
 * 子元素的点击/滚动；只有「起手在屏幕左缘 + 横向位移达标」才触发返回。
 */

const EDGE_ZONE = 40; // 起手必须落在屏幕左缘内（px）
const BACK_DISTANCE = 72; // 横向位移达到该值判定返回（px）
const SLOPE = 1.5; // 横向须明显大于纵向，避免与竖向滚动/列表误触

/** 与 Lynx TouchEvent 兼容的最小结构（只读取坐标） */
interface EdgeTouch {
    clientX: number;
    clientY: number;
}
interface EdgeTouchEvent {
    touches?: EdgeTouch[];
    changedTouches?: EdgeTouch[];
}

export interface EdgeBackHandlers {
    bindtouchstart: (e: EdgeTouchEvent) => void;
    bindtouchmove: (e: EdgeTouchEvent) => void;
    bindtouchend: (e: EdgeTouchEvent) => void;
    bindtouchcancel: (e: EdgeTouchEvent) => void;
}

export function useEdgeBackGesture(
    onBack: () => void,
    enabled: boolean,
): EdgeBackHandlers {
    const start = useRef<{ x: number; y: number } | null>(null);

    const onTouchStart = (e: EdgeTouchEvent) => {
        const t = e.touches?.[0] ?? e.changedTouches?.[0];
        start.current =
            t && t.clientX <= EDGE_ZONE
                ? { x: t.clientX, y: t.clientY }
                : null;
    };

    const onTouchMove = (_e: EdgeTouchEvent) => {
        // 移动过程中不做判定，touchend 统一结算，避免手势中途抖动误触
    };

    const onTouchEnd = (e: EdgeTouchEvent) => {
        if (!enabled || !start.current) return;
        const t = e.changedTouches?.[0] ?? e.touches?.[0];
        if (!t) return;
        const dx = t.clientX - start.current.x;
        const dy = t.clientY - start.current.y;
        if (dx >= BACK_DISTANCE && dx > Math.abs(dy) * SLOPE) {
            start.current = null;
            onBack();
        }
    };

    const onTouchCancel = () => {
        start.current = null;
    };

    return {
        bindtouchstart: onTouchStart,
        bindtouchmove: onTouchMove,
        bindtouchend: onTouchEnd,
        bindtouchcancel: onTouchCancel,
    };
}
