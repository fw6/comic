import { FONT, RADIUS, type AppTheme } from '../theme/index.js';

/**
 * 筛选 / 标签胶囊：激活态为强调色。
 */
export function Chip({
    theme,
    label,
    active,
    onTap,
}: {
    theme: AppTheme;
    label: string;
    active: boolean;
    onTap: () => void;
}) {
    const t = theme.tokens;
    return (
        <view
            bindtap={onTap}
            style={{
                backgroundColor: active ? t.accent : t.surfaceSunken,
                borderRadius: RADIUS.pill,
                minHeight: '44px',
                alignItems: 'center',
                justifyContent: 'center',
                paddingLeft: '14px',
                paddingRight: '14px',
                marginRight: '8px',
            }}
        >
            <text
                style={{
                    color: active ? t.onAccent : t.textSub,
                    fontSize: FONT.small,
                }}
            >
                {label}
            </text>
        </view>
    );
}
