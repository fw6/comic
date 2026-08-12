import { useEffect, useState } from '@lynx-js/react';
import { RADIUS, type AppTheme } from '../theme/index.js';

/**
 * 底部轻提示：墨色胶囊 + 淡入。父组件控制显隐（超时清空）。
 */
export function Snackbar({
    theme,
    message,
}: {
    theme: AppTheme;
    message: string;
}) {
    const t = theme.tokens;
    const [opacity, setOpacity] = useState(0);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setOpacity(1));
        return () => cancelAnimationFrame(raf);
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
                    backgroundColor:
                        theme.mode === 'ink'
                            ? 'rgba(240,236,225,0.95)'
                            : 'rgba(28,22,16,0.92)',
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
                        color:
                            theme.mode === 'ink'
                                ? 'rgba(20,20,26,0.92)'
                                : '#F5F1E8',
                        fontSize: '13px',
                    }}
                >
                    {message}
                </text>
            </view>
        </view>
    );
}
