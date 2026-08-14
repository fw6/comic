import { useState } from '@lynx-js/react';
import { FONT, RADIUS, type AppTheme } from '../theme/index.js';

/**
 * 浮动操作按钮：强调色 + 分层投影 + 按压缩放反馈。
 */
export function Fab({
    theme,
    onTap,
    label,
    accessibilityLabel,
}: {
    theme: AppTheme;
    onTap: () => void;
    label: string;
    accessibilityLabel?: string;
}) {
    const t = theme.tokens;
    const [pressed, setPressed] = useState(false);
    return (
        <view
            bindtap={onTap}
            accessibility-label={accessibilityLabel}
            bindtouchstart={() => setPressed(true)}
            bindtouchend={() => setPressed(false)}
            bindtouchcancel={() => setPressed(false)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'absolute',
                right: '16px',
                bottom: '24px',
                width: '56px',
                height: '56px',
                borderRadius: '28px',
                backgroundColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                    theme.mode === 'ink'
                        ? '0 6px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
                        : '0 6px 16px rgba(60,40,20,0.28)',
                transform: pressed ? 'scale(0.96)' : 'scale(1)',
                transitionProperty: 'transform',
                transitionDuration: '120ms',
                transitionTimingFunction: 'ease-out',
            }}
        >
            <text style={{ color: t.onAccent, fontSize: FONT.icon }}>
                {label}
            </text>
        </view>
    );
}
