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
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                height: '88px',
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
                            lineHeight: '28px',
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
                            lineHeight: '28px',
                        }}
                    >
                        ‹
                    </text>
                </view>
            ) : null}
            <text
                style={{
                    flexGrow: 1,
                    color: '#fff',
                    fontSize: '20px',
                    fontWeight: '600',
                    marginLeft: '8px',
                }}
            >
                {title}
            </text>
            {actions ? (
                <view
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    {actions}
                </view>
            ) : null}
        </view>
    );
}

const iconBtn = {
    width: '44px',
    height: '44px',
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
            style={{ ...iconBtn, paddingLeft: '4px', paddingRight: '4px' }}
            bindtap={onTap}
        >
            <text style={{ color, fontSize: '15px' }}>{label}</text>
        </view>
    );
}
