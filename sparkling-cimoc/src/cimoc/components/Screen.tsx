import type { ReactNode } from '@lynx-js/react';
import type { AppTheme } from '../theme/index.js';

/**
 * 页面脚手架：整屏 flex 列 + 主题底色。所有屏幕的根节点用它，避免重复写背景。
 */
export function Screen({
    theme,
    children,
    bg,
}: {
    theme: AppTheme;
    children: ReactNode;
    bg?: string;
}) {
    return (
        <view
            style={{
                alignItems: 'stretch',
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                backgroundColor: bg ?? theme.tokens.bg,
            }}
        >
            {children}
        </view>
    );
}
