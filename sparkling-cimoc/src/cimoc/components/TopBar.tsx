import type { ReactNode } from '@lynx-js/react';
import { FONT_SERIF, type AppTheme } from '../theme/index.js';

interface TopBarProps {
    theme: AppTheme;
    title: string;
    onBack?: () => void;
    onMenu?: () => void;
    /** right-side actions, rendered inline */
    actions?: ReactNode;
}

/**
 * 编辑式顶栏：墨/纸面底色 + 朱红书签 + 衬线标题。取代旧的纯色 Material 顶栏。
 */
export function TopBar({ theme, title, onBack, onMenu, actions }: TopBarProps) {
    const t = theme.tokens;
    return (
        <view
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                height: '88px',
                paddingTop: '24px',
                backgroundColor: t.surface,
                paddingLeft: '8px',
                paddingRight: '12px',
                borderBottomWidth: '1px',
                borderBottomColor: t.hairline,
            }}
        >
            {onMenu ? (
                <view style={iconBtn} bindtap={onMenu}>
                    <text style={{ color: t.text, fontSize: '20px' }}>☰</text>
                </view>
            ) : onBack ? (
                <view style={iconBtn} bindtap={onBack}>
                    <text style={{ color: t.text, fontSize: '26px' }}>‹</text>
                </view>
            ) : null}
            <view
                style={{
                    flexGrow: 1,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    minWidth: '0',
                    marginLeft: '4px',
                }}
            >
                <view
                    style={{
                        width: '3px',
                        height: '16px',
                        borderRadius: '2px',
                        backgroundColor: t.accent,
                        marginRight: '8px',
                    }}
                />
                <text
                    style={{
                        flexGrow: 1,
                        color: t.text,
                        fontSize: '19px',
                        fontWeight: '600',
                        ...FONT_SERIF,
                        letterSpacing: '1px',
                        textOverflow: 'ellipsis',
                    }}
                    text-maxline={'1'}
                >
                    {title}
                </text>
            </view>
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
    theme,
    label,
    onTap,
    color,
    accent = false,
}: {
    theme: AppTheme;
    label: string;
    onTap: () => void;
    /** 文字颜色，缺省为次级文字色 */
    color?: string;
    /** 强调色文字（主要动作） */
    accent?: boolean;
}) {
    const t = theme.tokens;
    return (
        <view
            style={{ ...iconBtn, paddingLeft: '4px', paddingRight: '4px' }}
            bindtap={onTap}
        >
            <text
                style={{
                    color: accent ? t.accent : (color ?? t.textSub),
                    fontSize: '15px',
                }}
            >
                {label}
            </text>
        </view>
    );
}
