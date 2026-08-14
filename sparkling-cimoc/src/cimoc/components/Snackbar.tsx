import { useEffect, useState } from '@lynx-js/react';
import { FONT, RADIUS, type AppTheme } from '../theme/index.js';

/**
 * 底部轻提示：墨色胶囊 + 淡入。父组件控制显隐（超时清空）。
 */
export function Snackbar({
    theme,
    message,
    onHide,
}: {
    theme: AppTheme;
    message: string;
    /** 展示结束（自动隐藏）回调，父组件清空消息 */
    onHide: () => void;
}) {
    const t = theme.tokens;
    const [opacity, setOpacity] = useState(0);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setOpacity(1));
        const timer = setTimeout(() => onHide(), 2500);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(timer);
        };
    }, []);
    return (
        <view
            style={{
                position: 'absolute',
                left: '24px',
                right: '24px',
                bottom: '80px',
                alignItems: 'center',
            }}
        >
            <view
                style={{
                    backgroundColor: t.inverse,
                    borderRadius: RADIUS.sm,
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    opacity,
                    transitionProperty: 'opacity',
                    transitionDuration: '200ms',
                    transitionTimingFunction: 'ease-out',
                }}
            >
                <text
                    style={{
                        color: t.onInverse,
                        fontSize: FONT.bodySm,
                    }}
                >
                    {message}
                </text>
            </view>
        </view>
    );
}
