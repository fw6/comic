import { FONT, type AppTheme } from '../theme/index.js';

/**
 * 居中占位态：加载中 / 空态。带装饰性网点纹理，避免单调灰字。
 */
export function EmptyState({
    theme,
    text,
    glyph,
}: {
    theme: AppTheme;
    text: string;
    glyph?: string;
}) {
    const t = theme.tokens;
    return (
        <view
            style={{
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage:
                    theme.mode === 'ink'
                        ? 'radial-gradient(circle, rgba(240,236,225,0.06) 1px, transparent 1px)'
                        : 'radial-gradient(circle, rgba(40,30,20,0.05) 1px, transparent 1px)',
                backgroundSize: '14px 14px',
            }}
        >
            {glyph ? (
                <text style={{ fontSize: FONT.glyph, marginBottom: '10px', opacity: 0.6 }}>
                    {glyph}
                </text>
            ) : null}
            <text style={{ fontSize: FONT.bodyLg, color: t.textMut }}>{text}</text>
        </view>
    );
}
