import type { ReactNode } from '@lynx-js/react';
import { type AppTheme } from '../theme/index.js';

/**
 * 列表行：标题 + 可选值 + › 或自定义右侧内容。
 */
export function Row({
    theme,
    title,
    value,
    onTap,
    children,
    danger = false,
}: {
    theme: AppTheme;
    title: string;
    value?: string;
    onTap?: () => void;
    /** 自定义右侧内容（覆盖 value） */
    children?: ReactNode;
    danger?: boolean;
}) {
    const t = theme.tokens;
    return (
        <view
            bindtap={onTap}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.surface,
                paddingTop: '14px',
                paddingBottom: '14px',
                paddingLeft: '16px',
                paddingRight: '16px',
                borderBottomWidth: '1px',
                borderBottomColor: t.hairline,
            }}
        >
            <text
                style={{
                    flexGrow: 1,
                    fontSize: '15px',
                    color: danger ? t.danger : t.text,
                }}
            >
                {title}
            </text>
            {children ?? (
                <>
                    {value ? (
                        <text
                            style={{ fontSize: '14px', color: t.textSub }}
                        >
                            {value}
                        </text>
                    ) : null}
                    <text
                        style={{ color: t.textMut, fontSize: '18px', marginLeft: '8px' }}
                    >
                        ›
                    </text>
                </>
            )}
        </view>
    );
}
