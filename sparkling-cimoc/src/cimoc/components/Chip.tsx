import { RADIUS, type AppTheme } from '../theme/index.js';

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
                paddingLeft: '12px',
                paddingRight: '12px',
                paddingTop: '5px',
                paddingBottom: '5px',
                marginRight: '8px',
            }}
        >
            <text
                style={{
                    color: active ? t.onAccent : t.textSub,
                    fontSize: '12px',
                }}
            >
                {label}
            </text>
        </view>
    );
}
