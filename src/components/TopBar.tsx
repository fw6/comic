import type { ReactNode } from '@lynx-js/react';
import type { AppTheme } from '../theme/index.js';

interface TopBarProps {
    theme: AppTheme;
    title: string;
    onBack?: () => void;
    onMenu?: () => void;
    /** right-side actions, rendered inline */
    actions?: ReactNode;
}

export function TopBar({ theme, title, onBack, onMenu, actions }: TopBarProps) {
    return (
        <view
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                height: 88,
                paddingTop: '24px',
                backgroundColor: theme.theme.primary,
                paddingLeft: '12px',
                paddingRight: '12px',
            }}
        >
            {onMenu ? (
                <view style={iconBtn} bindtap={onMenu}>
                    <text
                        style={{
                            color: '#fff',
                            fontSize: '22px',
                            lineHeight: 28,
                        }}
                    >
                        ☰
                    </text>
                </view>
            ) : onBack ? (
                <view style={iconBtn} bindtap={onBack}>
                    <text
                        style={{
                            color: '#fff',
                            fontSize: '24px',
                            lineHeight: 28,
                        }}
                    >
                        ‹
                    </text>
                </view>
            ) : null}
            <text
                style={{
                    flex: 1,
                    color: '#fff',
                    fontSize: '20px',
                    fontWeight: '600',
                    marginLeft: '8px',
                }}
            >
                {title}
            </text>
            {actions ? (
                <view style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {actions}
                </view>
            ) : null}
        </view>
    );
}

const iconBtn = {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
};

export function ToolbarAction({
    label,
    onTap,
    color = '#fff',
}: {
    label: string;
    onTap: () => void;
    color?: string;
}) {
    return (
        <view
            style={{ ...iconBtn, paddingLeft: '4px', paddingRight: 4 }}
            bindtap={onTap}
        >
            <text style={{ color, fontSize: 15 }}>{label}</text>
        </view>
    );
}
