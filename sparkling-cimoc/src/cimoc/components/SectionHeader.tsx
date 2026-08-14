import { FONT, FONT_SERIF, type AppTheme } from '../theme/index.js';

/**
 * 设置分组标题条：凹陷面 + 强调色文字。
 */
export function SectionHeader({
    theme,
    title,
}: {
    theme: AppTheme;
    title: string;
}) {
    const t = theme.tokens;
    return (
        <view
            style={{
                backgroundColor: t.surfaceSunken,
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: '16px',
                paddingRight: '16px',
            }}
        >
            <text
                style={{
                    color: t.accent,
                    fontSize: FONT.bodySm,
                    fontWeight: '600',
                    ...FONT_SERIF,
                    letterSpacing: '1px',
                }}
            >
                {title}
            </text>
        </view>
    );
}
